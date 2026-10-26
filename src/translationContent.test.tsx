import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { hospitalLexicon, hospitalPhrasesFor } from './hospitalLexicon'
import type { DialectId } from './hospitalLexicon'
import { createPhraseTranslator } from './phraseTranslation'
import { medicalLiteralRegex, replaceWording } from './medicalLiterals'

const dialects: DialectId[] = ['cantonese', 'minnan', 'shanghai', 'sichuan', 'northeast']
const phrases = Object.fromEntries(dialects.map((dialect) => [dialect, hospitalPhrasesFor(dialect)])) as Parameters<typeof createPhraseTranslator>[0]
const empty = { toDialect: [], toMandarin: [] }
const rules: Parameters<typeof createPhraseTranslator>[1] = { cantonese: empty, minnan: empty, shanghai: empty, sichuan: empty, northeast: empty }
const translate = createPhraseTranslator(phrases, rules, () => '方言')

beforeEach(() => {
  vi.useFakeTimers()
  const values = new Map<string, string>([['zhentu-onboarding-complete', 'true']])
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

it.each(dialects)('round-trips every hospital phrase without conflating positive, negative or uncertain meanings in %s', (dialect) => {
  for (const entry of hospitalLexicon) {
    const result = translate(entry.source, dialect, 'toDialect')!
    expect(result.confidence).toBe('phrase')
    const restored = translate(result.text, dialect, 'toMandarin')!
    expect(restored.confidence).toBe('phrase')
    expect(restored.text.replace(/[。？！]$/u, '')).toBe(entry.source)
  }
})

it.each(dialects)('composes fully covered symptom, negation and medication clauses in %s', (dialect) => {
  const result = translate('我头晕，没有发烧；我还没有吃药。', dialect, 'toDialect')!
  expect(result.confidence).toBe('phrase')
  expect(result.text).toBe([phrases[dialect].find((phrase) => phrase.source === '我头晕')!.text.replace(/。$/u, '，'),
    phrases[dialect].find((phrase) => phrase.source === '我没有发烧')!.text.replace(/。$/u, '；'),
    phrases[dialect].find((phrase) => phrase.source === '我还没有吃药')!.text].join(''))
})

it('recognizes traditional Cantonese and keeps question intent without needing typed question marks', () => {
  expect(translate('我冇發燒。', 'cantonese', 'toMandarin')?.text).toBe('我没有发烧。')
  expect(translate('我唔肯定對呢隻藥係咪過敏。', 'cantonese', 'toMandarin')?.text).toBe('我不确定对这个药是否过敏。')
  expect(translate('呢只藥要食幾多日', 'cantonese', 'toMandarin')?.text).toBe('这个药需要吃多少天？')
  expect(translate('我没有发烧？', 'cantonese', 'toDialect')?.text).toBe('我冇发烧？')
})

it('normalizes common speech transcript layout without changing clinical polarity', () => {
  expect(translate('嗯，我 没 有 发 烧。', 'cantonese', 'toDialect')?.text).toBe('我冇发烧。')
  expect(translate('我冇發燒', 'cantonese', 'toMandarin')?.text).toBe('我没有发烧。')
  expect(translate('那个，检查前 要 空腹吗', 'cantonese', 'toDialect')?.text).toBe('检查之前使唔使空肚？')
})

it('keeps substantive prefixes and line boundaries rather than guessing they are fillers', () => {
  for (const text of ['就是我没有发烧', '那个我头痛', '我\n头痛', '我头痛\n三天了']) {
    const result = translate(text, 'cantonese', 'toDialect')!
    expect(result.confidence).toBe('unmatched')
    expect(result.text).toBe(text)
  }
  expect(translate('  嗯，我没有发烧', 'cantonese', 'toDialect')?.text).toBe('我冇发烧。')
  expect(translate('我头晕\n我没有发烧', 'cantonese', 'toDialect')?.text).toBe('我头晕。我冇发烧。')
})

it('recognizes complete dialect phrases with internal commas in longer conversations', () => {
  expect(translate('唔該，兒科喺邊度？我冇發燒。', 'cantonese', 'toMandarin')?.text)
    .toBe('请问儿科在哪里？我没有发烧。')
  const result = translate('我恶心想吐，我没有发烧。', 'cantonese', 'toDialect')!
  expect(result.confidence).toBe('phrase')
  expect(translate(result.text, 'cantonese', 'toMandarin')?.text).toBe('我恶心想吐，我没有发烧。')
  const unknown = '唔该，儿科喺边度？但我唔知自己食过乜药。'
  expect(translate(unknown, 'cantonese', 'toMandarin')?.text).toBe(unknown)
  expect(translate(unknown, 'cantonese', 'toMandarin')?.confidence).toBe('unmatched')
})

it.each(dialects)('keeps hospital questions, appointment changes and nausea separate in %s', (dialect) => {
  const restore = (source: string) => translate(translate(source, dialect, 'toDialect')!.text, dialect, 'toMandarin')?.text
  expect(restore('需要家属陪着吗')).toBe('需要家属陪同吗？')
  expect(restore('我需要家属陪同')).toBe('我需要家属陪同。')
  expect(restore('我想呕吐')).toBe('我想吐。')
  expect(restore('我恶心想吐')).toBe('我恶心想吐。')
  expect(restore('我想改预约')).toBe('我想改预约。')
  expect(restore('我想改预约时间')).toBe('我想改预约时间。')
  expect(restore('我吃东西后更痛')).toBe('我吃东西后更痛。')
  expect(restore('我吃饭后更痛')).toBe('我吃饭后更痛。')
})

it('shows the symptom-pattern source and swaps a complete offline result back to Mandarin', () => {
  render(<App />)
  fireEvent.change(screen.getByLabelText('翻译成'), { target: { value: 'sichuan' } })
  fireEvent.change(screen.getByLabelText('普通话内容'), { target: { value: '我头痛3天了' } })
  fireEvent.click(screen.getByRole('button', { name: '立即翻译' }))
  const result = screen.getByRole('complementary', { name: '翻译结果' })
  expect(within(result).getByText('医院句式 · 待核对')).toBeInTheDocument()
  expect(within(result).getByText('我脑壳痛，症状时长：3天。')).toBeInTheDocument()
  expect(screen.queryByText('读法参考')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /交换翻译方向/u }))
  expect(screen.getByLabelText('四川话内容')).toHaveValue('我脑壳痛，症状时长：3天。')
  expect(within(result).getByText('我头痛3天了。')).toBeInTheDocument()
})

it.each(dialects)('keeps an intrinsic question visible before a subsequent statement in %s', (dialect) => {
  const source = '需要家属陪同吗，我还没有吃药。'
  const result = translate(source, dialect, 'toDialect')!
  expect(result.confidence).toBe('phrase')
  expect(result.text).toContain('？')
  expect(translate(result.text, dialect, 'toMandarin')?.text).toBe('需要家属陪同吗？我还没有吃药。')
})

it('auto-translates a timed negative statement and preserves it when the direction is swapped', () => {
  render(<App />)
  fireEvent.change(screen.getByLabelText('翻译成'), { target: { value: 'cantonese' } })
  fireEvent.change(screen.getByLabelText('普通话内容'), { target: { value: '我今天没有发烧' } })
  act(() => { vi.advanceTimersByTime(800) })
  const result = screen.getByRole('complementary', { name: '翻译结果' })
  expect(within(result).getByText('医院句式 · 待核对')).toBeInTheDocument()
  expect(within(result).getByText('我冇发烧，时间范围：今天。')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /交换翻译方向/u }))
  expect(within(result).getByText('我今天没有发烧。')).toBeInTheDocument()
})

it('translates a chosen event-count example and keeps the count when swapping direction', () => {
  render(<App />)
  fireEvent.change(screen.getByLabelText('翻译成'), { target: { value: 'cantonese' } })
  fireEvent.click(screen.getByRole('button', { name: '打开症状短句' }))
  fireEvent.click(screen.getByRole('button', { name: '我今天吐了三次' }))
  const result = screen.getByRole('complementary', { name: '翻译结果' })
  expect(screen.getByLabelText('普通话内容')).toHaveValue('我今天吐了三次')
  expect(within(result).getByText('我已经呕咗，呕吐次数：三次，时间范围：今天。')).toBeInTheDocument()
  expect(within(result).getByText('医院句式 · 待核对')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /交换翻译方向/u }))
  expect(within(result).getByText('我今天吐了三次。')).toBeInTheDocument()
})

it('does not skip an unknown clause or convert a decimal point into a sentence boundary', () => {
  for (const text of ['我头晕，昨晚吃了三片药。', '我没有发烧，但是呼吸很急促。', '体温是38.5℃。']) {
    const result = translate(text, 'cantonese', 'toDialect')!
    expect(result.confidence).toBe('unmatched')
    expect(result.text).toBe(text)
  }
})

it('applies longest wording rules once while preserving drug-dose pairs, measurements, dates and times', () => {
  const text = '请慢一点说，我吃阿莫西林250 mg和布洛芬200mg，血压125/80mmHg，体温三十七度半，预约2026-10-20 08:30。'
  const result = replaceWording(text, [['一点', '一啲'], ['慢一点说', '讲慢啲'], ['讲', '说'], ['吃', '食'], ['天', '日'], ['mg', 'g']])
  expect(result.startsWith('请讲慢啲，我食')).toBe(true)
  expect([...result.matchAll(medicalLiteralRegex())].map((match) => match[0])).toEqual([
    '阿莫西林250 mg', '布洛芬200mg', '125/80mmHg', '三十七度半', '2026-10-20', '08:30',
  ])
})

it.each([
  ['minnan', '我無爽快。'], ['shanghai', '我勿适意。'], ['sichuan', '我不舒服。'], ['northeast', '我不舒坦。'],
])('does not invent a mild or severe degree of discomfort in %s', (dialect, expected) => {
  render(<App />)
  fireEvent.change(screen.getByLabelText('翻译成'), { target: { value: dialect } })
  fireEvent.change(screen.getByLabelText('普通话内容'), { target: { value: '我不舒服' } })
  fireEvent.click(screen.getByRole('button', { name: '立即翻译' }))
  expect(within(screen.getByRole('complementary', { name: '翻译结果' })).getByText(expected)).toBeInTheDocument()
})

it('does not disguise an unverified Shanghai spelling as a reading guide', () => {
  render(<App />)
  fireEvent.change(screen.getByLabelText('翻译成'), { target: { value: 'shanghai' } })
  fireEvent.change(screen.getByLabelText('普通话内容'), { target: { value: '我要验血' } })
  fireEvent.click(screen.getByRole('button', { name: '立即翻译' }))
  expect(screen.queryByText('读法参考')).not.toBeInTheDocument()
  expect(screen.queryByText('ngu yao nyi xie')).not.toBeInTheDocument()
})
