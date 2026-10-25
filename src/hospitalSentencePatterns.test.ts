import { expect, it } from 'vitest'
import { hospitalPhrasesFor, type DialectId } from './hospitalLexicon'
import { createPhraseTranslator } from './phraseTranslation'

const dialects: DialectId[] = ['cantonese', 'minnan', 'shanghai', 'sichuan', 'northeast']
const phrases = Object.fromEntries(dialects.map((dialect) => [dialect, hospitalPhrasesFor(dialect)])) as Parameters<typeof createPhraseTranslator>[0]
const empty = { toDialect: [], toMandarin: [] }
const rules = { cantonese: empty, minnan: empty, shanghai: empty, sichuan: empty, northeast: empty }
const translate = createPhraseTranslator(phrases, rules, () => '方言')

it.each(dialects)('translates symptom duration offline and restores its meaning in %s', (dialect) => {
  for (const duration of ['三天', '1.5小时', '两个小时', '半小时', '２０分钟', '兩個月']) {
    const result = translate(`我头痛${duration}了`, dialect, 'toDialect')!
    expect(result.confidence).toBe('template')
    expect(result.text).toBe(`${phrases[dialect].find((phrase) => phrase.source === '我头痛')!.text.slice(0, -1)}，症状时长：${duration}。`)
    expect(result.pronunciation).toBe('')
    expect(translate(result.text, dialect, 'toMandarin')?.text).toBe(`我头痛${duration}了。`)
    expect(translate(result.text, dialect, 'toMandarin')?.confidence).toBe('template')
  }
})

it.each(dialects)('preserves onset and anatomical side without inferring a calendar date in %s', (dialect) => {
  for (const time of ['昨晚', '昨天晚上', '今天下午', '三天前']) {
    const result = translate(`我从${time}开始右边肚子疼`, dialect, 'toDialect')!
    expect(result.confidence).toBe('template')
    expect(result.text).toContain(`开始时间：${time}`)
    expect(translate(result.text, dialect, 'toMandarin')?.text).toBe(`我从${time}开始右边肚子痛。`)
  }
})

it('accepts explicit duration word order and speech layout variants', () => {
  for (const text of ['我头疼已经3天了', '我已经头痛3天了', '我头痛，已经3天了', '  嗯，呃，我 头 疼 3天了。']) {
    expect(translate(text, 'sichuan', 'toDialect')?.text).toBe('我脑壳痛，症状时长：3天。')
  }
  expect(translate('我昨天晚上开始头晕', 'sichuan', 'toDialect')?.text).toBe('我脑壳昏，开始时间：昨天晚上。')
  expect(translate('我腦殼痛3天了', 'sichuan', 'toMandarin')?.text).toBe('我头痛3天了。')
})

it.each([
  '我可能头痛三天了', '我没有头痛三天了', '我头痛大概三天了', '我头痛三到五天了',
  '我头痛三天前就好了', '我头痛了三天', '我妈妈头痛三天了', '我头痛得厉害三天了',
  '我从昨晚开始头晕但现在好了', '我头痛三天了，今天又吐了。', '我胸痛三天了',
  '我头痛？三天了', '我头痛！三天了', '我头痛？,症状时长：三天',
])('retains unsupported qualifiers instead of certifying a partial sentence: %s', (text) => {
  const result = translate(text, 'cantonese', 'toDialect')!
  expect(result.confidence).toBe('unmatched')
  expect(result.text).toBe(text)
})

it.each(dialects)('composes symptoms with time and negative clauses without changing their order in %s', (dialect) => {
  const result = translate('我头痛3天了，没有发烧；我还没有吃药。', dialect, 'toDialect')!
  expect(result.confidence).toBe('template')
  const restored = translate(result.text, dialect, 'toMandarin')!
  expect(restored.confidence).toBe('template')
  expect(restored.text).toBe('我头痛3天了，我没有发烧；我还没有吃药。')
})
