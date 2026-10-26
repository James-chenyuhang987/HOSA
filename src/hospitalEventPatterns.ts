import type { Phrase } from './hospitalLexicon'
import { timeScopePattern } from './hospitalTime'
import { endingFor, prepareForMatch, stripEnding } from './translationMatching'
import type { Direction, Translation } from './translationTypes'

// Only positive, explicitly completed events are supported. A zero, decimal,
// unknown count or daily frequency must not turn into “already happened”.
const digit = '[一二三四五六七八九]'
const integer = `(?:[1-9１-９][0-9０-９]{0,2}|[两兩]|${digit}|十${digit}?|[二三四五六七八九]十${digit}?)`
const amount = `(?:${integer}(?:到|至|[-–—~～])${integer}|${integer})`
const count = `(?:(?:大约|大約|大概|约|約|差不多))?${amount}次(?:左右)?`
const events = [
  {
    source: '我已经吐了', label: '呕吐次数', labelPattern: '(?:呕吐次数|嘔吐次數)',
    actions: [`(?:呕吐|嘔吐|吐)了(${count})(?:了)?`, `(?:呕吐|嘔吐|吐)(${count})了`],
    restore: (value: string) => `吐了${value}`,
  },
  {
    source: '我拉肚子', label: '腹泻次数', labelPattern: '(?:腹泻次数|腹瀉次數)',
    actions: [`拉了(${count})肚子(?:了)?`, `(?:拉肚子|腹泻|腹瀉)了(${count})(?:了)?`, `(?:拉肚子|腹泻|腹瀉)(${count})了`],
    restore: (value: string) => `拉了${value}肚子`,
  },
].map((event) => ({
  ...event,
  inputs: event.actions.map((action) => new RegExp(`^(?:已经|已經)?${action}$`, 'u')),
  output: new RegExp(`^([^。！？!?；;:：\\n]+?)[，,]${event.labelPattern}[:：](${count})(?:[，,](?:时间范围|時間範圍)[:：](${timeScopePattern}))?$`, 'u'),
}))
const subjectInput = new RegExp(`^我(${timeScopePattern})?([^。！？!?；;:：\\n]+)$`, 'u')
const leadingScope = new RegExp(`^(${timeScopePattern})[，,]?我([^。！？!?；;:：\\n]+)$`, 'u')

export function translateHospitalEventPattern(
  source: string, direction: Direction, lookup: (text: string) => Phrase | null,
): Translation | null {
  const input = stripEnding(prepareForMatch(source))
  for (const event of events) {
    let phrase: Phrase | null
    let value: string | undefined
    let scope: string | undefined
    if (direction === 'toDialect') {
      const subject = subjectInput.exec(input) ?? leadingScope.exec(input)
      if (!subject) continue
      const action = event.inputs.map((pattern) => pattern.exec(subject[2])).find(Boolean)
      if (!action) continue
      phrase = lookup(event.source)
      value = action[1]
      scope = subject[1]
    } else {
      const output = event.output.exec(input)
      if (!output) continue
      phrase = lookup(output[1])
      value = output[2]
      scope = output[3]
    }
    // Do not pair a count label with a different symptom or a negative phrase.
    if (!phrase || phrase.source !== event.source) continue
    const text = direction === 'toDialect'
      ? `${stripEnding(phrase.text)}，${event.label}：${value}${scope ? `，时间范围：${scope}` : ''}`
      : `我${scope ?? ''}${event.restore(value)}`
    return {
      text: text + endingFor(source), confidence: 'template', pronunciation: '',
      note: '事件使用已收录短句，次数和时间范围用书面语单独保留；约数与范围不换算，不推断每日频率、病因或其他分句的时间。请让医护人员核对次数、时间和方言表达。',
    }
  }
  return null
}
