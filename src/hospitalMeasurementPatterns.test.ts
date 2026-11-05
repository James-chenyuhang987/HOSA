import { expect, it } from 'vitest'
import { translateHospitalMeasurementPattern } from './hospitalMeasurementPatterns'

const dialects = ['cantonese', 'minnan', 'shanghai', 'sichuan', 'northeast'] as const

it.each(dialects)('preserves temperature, pressure and pain score values in %s', (dialect) => {
  for (const [source, expected, restored] of [
    ['我的体温是38.5℃', '体温：38.5℃。', '我的体温是38.5℃。'],
    ['我体温37度半', '体温：37度半。', '我的体温是37度半。'],
    ['我的血压是125/80mmHg', '血压：125/80mmHg。', '我的血压是125/80mmHg。'],
    ['我的血压是 125 / 80 毫米汞柱', '血压：125 / 80 毫米汞柱。', '我的血压是125 / 80 毫米汞柱。'],
    ['我的疼痛评分是7分', '疼痛评分：7分。', '我的疼痛评分是7分。'],
    ['我疼痛8级', '疼痛评分：8级。', '我的疼痛评分是8级。'],
  ] as const) {
    const result = translateHospitalMeasurementPattern(source, 'toDialect')!
    expect(result.confidence, `${dialect}:${source}`).toBe('template')
    expect(result.text, `${dialect}:${source}`).toBe(expected)
    expect(result.pronunciation).toBe('')
    expect(translateHospitalMeasurementPattern(result.text, 'toMandarin')?.text).toBe(restored)
  }
})

it('accepts traditional labels and keeps the original written units', () => {
  expect(translateHospitalMeasurementPattern('體溫：３８．５攝氏度。', 'toMandarin')?.text).toBe('我的体温是３８．５攝氏度。')
  expect(translateHospitalMeasurementPattern('血壓：125/80毫米汞柱。', 'toMandarin')?.text).toBe('我的血压是125/80毫米汞柱。')
})

it.each([
  '体温是38.5℃', '今天我的体温是38.5℃', '妈妈的体温是38.5℃', '我体温是三十八度',
  '我体温是38', '我血压是125', '我血压是125/80mm', '我血压是125/80/70',
  '我今天血压是125/80', '我的疼痛评分是十分', '我疼痛评分是', '我疼痛评分是7',
  '我体温是38.5℃，我头痛', '体温：38.5℃，时间范围：今天',
])('does not infer a measurement from unsupported subject, unit or extra text: %s', (source) => {
  expect(translateHospitalMeasurementPattern(source, 'toDialect')).toBeNull()
})
