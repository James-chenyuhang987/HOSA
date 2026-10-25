import OpenCC from 'opencc-js/t2cn'

const simplify = OpenCC.Converter({ from: 't', to: 'cn' })
export const stripEnding = (text: string) => text.trim().replace(/[。！？!?；;，,、]+$/u, '')

// Keep line breaks as sentence boundaries. In particular, never join a symptom
// to a separate line containing a negation or a time qualifier.
export const prepareForMatch = (text: string) => text.normalize('NFC').trim()
  .replace(/[\u200b\u200c\u200d]/gu, '')
  .replace(/\r\n?/gu, '\n')
  .replace(/(?<=[\p{Script=Han}])[^\S\r\n]+(?=[\p{Script=Han}])/gu, '')
  .replace(/[^\S\r\n]+/gu, ' ')
  // Only delimited fillers are disposable; “那个药” and “就是这个药”
  // carry meaning and must never be shortened into a known phrase.
  .replace(/^(?:(?:嗯+|呃+|啊+|那个|就是)[ ，,、:：-]+){1,3}/u, '')

export const normalizeForMatch = (text: string) => stripEnding(simplify(prepareForMatch(text)))
  .replace(/[，、]/gu, ',')
  .replace(/；/gu, ';')
  .replace(/：/gu, ':')
  .replace(/ *([,;:]) */gu, '$1')

export const endingFor = (text: string, reference = '') => /[?？]$/u.test(text.trim()) || /[?？]$/u.test(reference.trim())
  ? '？' : /[!！]$/u.test(text.trim()) ? '！' : '。'
