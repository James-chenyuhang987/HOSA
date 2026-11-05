import { endingFor, prepareForMatch, stripEnding } from './translationMatching'
import type { Direction, Translation } from './translationTypes'

// Measurements are deliberately treated as structured written facts. The
// translator never converts units, rounds values, or decides whether a value
// is medically abnormal.
const number = '[0-9０-９]{1,3}(?:[.．][0-9０-９]{1,2})?'
const temperature = `(?:${number}(?:℃|摄氏度|攝氏度|度半|度))`
const pressure = String.raw`[0-9０-９]{2,3}\s*/\s*[0-9０-９]{2,3}\s*(?:mmHg|毫米汞柱)?`
const score = `(?:${number})(?:分|级|級)`

type Measurement = {
  kind: 'temperature' | 'pressure' | 'pain'
  label: string
  input: RegExp
  output: RegExp
  value: (match: RegExpExecArray) => string
  restore: (value: string) => string
}

const measurements: Measurement[] = [
  {
    kind: 'temperature', label: '体温',
    input: new RegExp(`^我(?:的)?(?:体温|體溫)(?:是|为|為|有)?(${temperature})$`, 'u'),
    output: new RegExp(`^(?:体温|體溫)[：:](${temperature})$`, 'u'),
    value: (match) => match[1], restore: (value) => `我的体温是${value}`,
  },
  {
    kind: 'pressure', label: '血压',
    input: new RegExp(`^我(?:的)?血压(?:是|为|為|有)?\\s*(${pressure})$`, 'u'),
    output: new RegExp(`^(?:血压|血壓)[：:](${pressure})$`, 'u'),
    value: (match) => match[1], restore: (value) => `我的血压是${value}`,
  },
  {
    kind: 'pain', label: '疼痛评分',
    input: new RegExp(`^我(?:的)?疼痛(?:评分|評分)?(?:是|为|為|有)?(${score})$`, 'u'),
    output: new RegExp(`^疼痛评分[：:](${score})$`, 'u'),
    value: (match) => match[1], restore: (value) => `我的疼痛评分是${value}`,
  },
]

export function translateHospitalMeasurementPattern(source: string, direction: Direction): Translation | null {
  const input = stripEnding(prepareForMatch(source))
  for (const measurement of measurements) {
    const match = direction === 'toDialect' ? measurement.input.exec(input) : measurement.output.exec(input)
    if (!match) continue
    const value = measurement.value(match)
    const text = direction === 'toDialect' ? `${measurement.label}：${value}` : measurement.restore(value)
    return {
      text: `${text}${endingFor(source)}`,
      confidence: 'template',
      pronunciation: '',
      note: `${measurement.label}和数值按原文保留，不换算、不四舍五入，也不判断是否异常。请让医护人员核对数字、单位和记录时间。`,
    }
  }
  return null
}
