import type { DialectId, Phrase } from './hospitalLexicon'
import type { Direction, Translation } from './translationTypes'
import { replaceWording } from './medicalLiterals'
import { translateHospitalPattern } from './hospitalSentencePatterns'
import { translateHospitalEventPattern } from './hospitalEventPatterns'
import { endingFor, normalizeForMatch, stripEnding } from './translationMatching'
export { endingFor, normalizeForMatch } from './translationMatching'

type Rules = Record<DialectId, Record<Direction, Array<[string, string]>>>
export function createPhraseTranslator(phrases: Record<DialectId, Phrase[]>, rules: Rules, label: (id: DialectId) => string) {
  const indexes = new Map<string, Map<string, Phrase | null>>()
  const indexFor = (dialect: DialectId, direction: Direction) => {
    const key = `${dialect}:${direction}`
    if (indexes.has(key)) return indexes.get(key)!
    const index = new Map<string, Phrase | null>()
    for (const phrase of phrases[dialect]) {
      const inputs = direction === 'toDialect' ? [phrase.source, ...(phrase.aliases ?? [])] : [phrase.text]
      for (const input of inputs) {
        const normalized = normalizeForMatch(input)
        if (index.has(normalized) && index.get(normalized)?.source !== phrase.source) index.set(normalized, null)
        else if (!index.has(normalized)) index.set(normalized, phrase)
      }
    }
    indexes.set(key, index)
    return index
  }
  const exact = (text: string, dialect: DialectId, direction: Direction): Translation | null => {
    const phrase = indexFor(dialect, direction).get(normalizeForMatch(text))
    if (!phrase) return null
    return {
      text: (direction === 'toDialect' ? stripEnding(phrase.text) : phrase.source) + endingFor(text, phrase.text),
      pronunciation: direction === 'toDialect' ? phrase.pronunciation : '普通话无需额外标注读法。',
      note: direction === 'toDialect' ? phrase.note : '这是根据常用短句识别出的普通话含义，涉及用药和检查安排时请再次确认。',
      confidence: 'phrase',
    }
  }
  const segment = (text: string, dialect: DialectId, direction: Direction) => exact(text, dialect, direction)
    ?? translateHospitalPattern(text, direction, (symptom) => indexFor(dialect, direction).get(normalizeForMatch(symptom)) ?? null)
    ?? translateHospitalEventPattern(text, direction, (statement) => indexFor(dialect, direction).get(normalizeForMatch(statement)) ?? null)
  return (source: string, dialect: DialectId, direction: Direction): Translation | null => {
    if (!stripEnding(source)) return null
    const single = segment(source, dialect, direction)
    if (single) return single
    // Find complete phrases at punctuation boundaries, including phrases with
    // their own commas. Backtrack only to another FULL covering; never skip an
    // unknown clause, cross a sentence boundary or split decimal points.
    const input = source.trim().replace(/\r\n?/gu, '\n')
    const parts = [...input.matchAll(/([^，,。！？!?；;\n]+)([，,。！？!?；;\n]*)/gu)]
    if (parts.length > 1 && parts.map((part) => part[0]).join('') === input) {
      type Piece = { result: Translation; original: string; separator: string }
      const covers = new Map<number, Piece[] | null>([[parts.length, []]])
      const cover = (start: number): Piece[] | null => {
        if (covers.has(start)) return covers.get(start)!
        let end = start
        while (end < parts.length - 1 && !/[。！？!?\n]/u.test(parts[end][2])) end += 1
        for (; end >= start; end -= 1) {
          const original = parts.slice(start, end + 1).map((part) => part[0]).join('')
          const result = segment(original, dialect, direction)
          if (!result) continue
          const rest = cover(end + 1)
          if (!rest) continue
          const pieces = [{ result, original, separator: parts[end][2] }, ...rest]
          covers.set(start, pieces)
          return pieces
        }
        covers.set(start, null)
        return null
      }
      const results = cover(0)
      if (results) {
        const hasTemplate = results.some(({ result }) => result.confidence === 'template')
        return {
          text: results.map(({ result, original, separator }, index) => {
            const punctuation = /[?？]$/u.test(result.text) ? '？' : index === results.length - 1 || /[。！？!?\n]/u.test(separator)
              ? endingFor(original, result.text) : /[；;]/u.test(separator) ? '；' : '，'
            return stripEnding(result.text) + punctuation
          }).join(''),
          pronunciation: '组合短句的完整读音尚待核对。',
          note: `按已收录短句${hasTemplate ? '和医院句式' : ''}逐句组合，保留原句顺序。${hasTemplate ? '时间范围只限定对应分句，不代表症状开始时间。' : ''}请对照原文核对症状、否定和时间；方言表达仍待当地使用者核对。`,
          confidence: hasTemplate ? 'template' : 'phrase',
        }
      }
    }
    const normalized = stripEnding(source)
    const translated = replaceWording(normalized, rules[dialect][direction])
    if (translated !== normalized) return {
      text: translated + endingFor(source),
      pronunciation: direction === 'toDialect' ? `${label(dialect)}各地读音不同，文字仅作表达参考。` : '普通话无需额外标注读法。',
      note: '仅替换已收录的部分用词，尚未完成整句翻译。药名、剂量、症状和否定语气请对照原文确认。',
      confidence: 'wording',
    }
    return {
      text: source.trim(),
      pronunciation: direction === 'toDialect' ? '暂未提供读法' : '暂未识别这句方言',
      note: '这句话暂未覆盖常用表达，可以先保留原文，再请现场人员协助确认，或开启整句翻译。',
      confidence: 'unmatched',
    }
  }
}
