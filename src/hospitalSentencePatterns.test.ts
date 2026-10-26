import { expect, it } from 'vitest'
import { hospitalPhrasesFor, type DialectId } from './hospitalLexicon'
import { createPhraseTranslator } from './phraseTranslation'

const dialects: DialectId[] = ['cantonese', 'minnan', 'shanghai', 'sichuan', 'northeast']
const phrases = Object.fromEntries(dialects.map((dialect) => [dialect, hospitalPhrasesFor(dialect)])) as Parameters<typeof createPhraseTranslator>[0]
const empty = { toDialect: [], toMandarin: [] }
const rules = { cantonese: empty, minnan: empty, shanghai: empty, sichuan: empty, northeast: empty }
const translate = createPhraseTranslator(phrases, rules, () => '方言')

it.each(dialects)('translates symptom duration offline and restores its meaning in %s', (dialect) => {
  for (const duration of [
    '三天', '1.5小时', '两个小时', '半小时', '２０分钟', '兩個月', '大概三天', '三到五天',
    '3～5天', '一天半', '两个半小时', '大約兩個半月', '1小时30分钟', '两天三小时', '三天左右',
  ]) {
    const result = translate(`我头痛${duration}了`, dialect, 'toDialect')!
    expect(result.confidence).toBe('template')
    expect(result.text).toBe(`${phrases[dialect].find((phrase) => phrase.source === '我头痛')!.text.slice(0, -1)}，症状时长：${duration}。`)
    expect(result.pronunciation).toBe('')
    expect(translate(result.text, dialect, 'toMandarin')?.text).toBe(`我头痛${duration}了。`)
    expect(translate(result.text, dialect, 'toMandarin')?.confidence).toBe('template')
  }
})

it.each(dialects)('preserves onset and anatomical side without inferring a calendar date in %s', (dialect) => {
  for (const time of ['昨晚', '昨天晚上', '今天下午', '三天前', '大约三天前']) {
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
  '我可能头痛三天了', '我没有头痛三天了', '我不确定头痛了几天', '我头痛三天到五小时了',
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

it.each(dialects)('keeps an explicit time scope distinct from symptom onset in %s', (dialect) => {
  const scoped = translate('我昨天头晕', dialect, 'toDialect')!
  expect(scoped.confidence).toBe('template')
  expect(scoped.text).toContain('时间范围：昨天')
  expect(scoped.text).not.toContain('开始时间')
  expect(translate(scoped.text, dialect, 'toMandarin')?.text).toBe('我昨天头晕。')
  const started = translate('我从昨天开始头晕', dialect, 'toDialect')!
  expect(started.text).toContain('开始时间：昨天')
  expect(translate(started.text, dialect, 'toMandarin')?.text).toBe('我从昨天开始头晕。')
})

it.each(dialects)('keeps negation, uncertainty and completed events inside their scoped statements in %s', (dialect) => {
  for (const statement of ['我没有发烧', '我没有咳嗽', '我没有呕吐', '我还没有吃药', '我已经吐了', '我不确定对这个药是否过敏', '我可能怀孕了', '我胸口很痛', '我恶心想吐']) {
    for (const scope of ['今天', '昨天晚上', '过去三天', '最近大约3天', '这两天']) {
      const source = `我${scope}${statement.slice(1)}`
      const result = translate(source, dialect, 'toDialect')!
      expect(result.confidence, source).toBe('template')
      const base = phrases[dialect].find((phrase) => phrase.source === statement)!.text.slice(0, -1)
      expect(result.text, source).toBe(`${base}，时间范围：${scope}。`)
      const restored = translate(result.text, dialect, 'toMandarin')!
      expect(restored.confidence, source).toBe('template')
      expect(restored.text, source).toBe(`${source}。`)
    }
  }
})

it('accepts a leading time scope while requiring the full known first-person statement', () => {
  for (const source of ['今天我没有发烧', '今天，我没有发烧', '我今天没有发烧']) {
    expect(translate(source, 'cantonese', 'toDialect')?.text).toBe('我冇发烧，时间范围：今天。')
  }
  expect(translate('今天我不确定对这个药是否过敏', 'cantonese', 'toDialect')?.text)
    .toBe('我唔肯定对呢只药係咪过敏，时间范围：今天。')
})

it.each([
  '我三天没有发烧', '我没有发烧三天了', '我昨天没有头晕但今天头晕了', '我今天也没有发烧',
  '我昨天开始没有发烧', '我今天不确定有没有发烧', '今天妈妈没有发烧', '今天没有发烧',
  '今天？我没有发烧', '我今天没有发烧？时间范围：昨天', '我头痛五毫克了', '我头痛1小时30毫克了',
  '我今天需要停药吗', '我头痛3天以后了',
])('does not infer scope, subject, polarity, doses or an unknown statement: %s', (source) => {
  const result = translate(source, 'cantonese', 'toDialect')!
  expect(result.confidence).toBe('unmatched')
  expect(result.text).toBe(source)
})

it.each(dialects)('does not spread a time scope over a later clause in %s', (dialect) => {
  const result = translate('今天我头痛，没有发烧；昨天我已经吐了。', dialect, 'toDialect')!
  expect(result.confidence).toBe('template')
  expect(translate(result.text, dialect, 'toMandarin')?.text).toBe('我今天头痛，我没有发烧；我昨天已经吐了。')
})
