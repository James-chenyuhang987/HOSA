import { expect, it } from 'vitest'
import { hospitalPhrasesFor, type DialectId } from './hospitalLexicon'
import { createPhraseTranslator } from './phraseTranslation'

const dialects: DialectId[] = ['cantonese', 'minnan', 'shanghai', 'sichuan', 'northeast']
const phrases = Object.fromEntries(dialects.map((dialect) => [dialect, hospitalPhrasesFor(dialect)])) as Parameters<typeof createPhraseTranslator>[0]
const empty = { toDialect: [], toMandarin: [] }
const rules = { cantonese: empty, minnan: empty, shanghai: empty, sichuan: empty, northeast: empty }
const translate = createPhraseTranslator(phrases, rules, () => '方言')

it.each(dialects)('preserves completed event counts and their own time scopes in %s', (dialect) => {
  for (const count of ['三次', '3次', '３次', '两次', '十一次', '二十三次', '大约三次', '三到五次', '3～5次', '三次左右']) {
    for (const scope of ['今天', '昨天晚上', '过去三天']) {
      for (const [source, phrase, label] of [
        [`我${scope}吐了${count}`, '我已经吐了', '呕吐次数'],
        [`我${scope}拉了${count}肚子`, '我拉肚子', '腹泻次数'],
      ]) {
        const result = translate(source, dialect, 'toDialect')!
        const base = phrases[dialect].find((entry) => entry.source === phrase)!.text.slice(0, -1)
        expect(result.confidence, source).toBe('template')
        expect(result.text, source).toBe(`${base}，${label}：${count}，时间范围：${scope}。`)
        expect(result.text).not.toContain('症状时长')
        expect(result.pronunciation).toBe('')
        expect(translate(result.text, dialect, 'toMandarin')?.text).toBe(`${source}。`)
        expect(translate(result.text, dialect, 'toMandarin')?.confidence).toBe('template')
      }
    }
  }
})

it('recognizes explicit completed-event word order and transcript variants without inventing a time', () => {
  for (const source of ['我今天呕吐了三次', '今天我已经吐了三次', '今天，我吐三次了', '我今天吐了三次了', '嗯，我 今 天 嘔 吐 了 三 次。']) {
    expect(translate(source, 'cantonese', 'toDialect')?.text).toBe('我已经呕咗，呕吐次数：三次，时间范围：今天。')
  }
  for (const source of ['我昨天腹泻了两次', '昨天我拉肚子两次了', '昨天，我已经拉了两次肚子']) {
    expect(translate(source, 'cantonese', 'toDialect')?.text).toBe('我肚屙，腹泻次数：两次，时间范围：昨天。')
  }
  expect(translate('我吐了3次', 'cantonese', 'toDialect')?.text).toBe('我已经呕咗，呕吐次数：3次。')
  expect(translate('我已经呕咗，呕吐次数：3次。', 'cantonese', 'toMandarin')?.text).toBe('我吐了3次。')
})

it('accepts traditional structured labels without changing their count and scope literals', () => {
  expect(translate('我已經嘔咗，嘔吐次數：大約三次，時間範圍：昨天。', 'cantonese', 'toMandarin')?.text)
    .toBe('我昨天吐了大約三次。')
  expect(translate('我肚屙，腹瀉次數：兩次，時間範圍：過去三天。', 'cantonese', 'toMandarin')?.text)
    .toBe('我過去三天拉了兩次肚子。')
})

it.each(dialects)('keeps different event counts, times and a subsequent negative clause separate in %s', (dialect) => {
  const source = '我今天吐了三次；我昨天拉了两次肚子，我没有发烧。'
  const result = translate(source, dialect, 'toDialect')!
  expect(result.confidence).toBe('template')
  expect(translate(result.text, dialect, 'toMandarin')?.text).toBe(source)
  const noScope = translate('我今天吐了三次；我拉了两次肚子。', dialect, 'toDialect')!
  expect(translate(noScope.text, dialect, 'toMandarin')?.text).toBe('我今天吐了三次；我拉了两次肚子。')
})

it.each([
  '我今天没有吐三次', '我可能吐了三次', '我今天也吐了三次', '我不确定吐了三次没有',
  '我妈妈今天吐了三次', '今天吐了三次', '我今天吐了0次', '我今天吐了０次', '我今天吐了零次',
  '我吐了0到3次', '我吐了1.5次', '我吐了三毫克', '我拉了三天肚子', '我今天吐血了三次',
  '我每天吐三次', '我每小时吐了三次', '我今天每次吐了三次', '我吐了三次但是现在好了',
  '我今天要吐三次', '我今天吐了几次', '我吐了三次吗', '我吐了\n三次', '我吐了？三次',
  '我今天吐了三次，昨天吃了两片药。',
])('keeps unsupported negation, frequency, subjects, units or extra content: %s', (source) => {
  const result = translate(source, 'cantonese', 'toDialect')!
  expect(result.confidence).toBe('unmatched')
  expect(result.text).toBe(source)
})

it.each([
  '我冇呕，呕吐次数：3次。', '我想呕，呕吐次数：3次。', '我已经呕咗，腹泻次数：3次。',
  '我肚屙，呕吐次数：3次。', '我已经呕咗，呕吐次数：0次。',
  '我已经呕咗，呕吐次数：3次，时间范围：每天。', '我已经呕咗，呕吐次数：3次，时间范围：今天，但现在好了。',
])('rejects mismatched or incomplete reverse event qualifiers: %s', (source) => {
  const result = translate(source, 'cantonese', 'toMandarin')!
  expect(result.confidence).toBe('unmatched')
  expect(result.text).toBe(source)
})
