import OpenCC from 'opencc-js/t2cn'
import type { DialectId, Phrase } from './hospitalLexicon'
import type { Direction, Translation } from './translationTypes'
import { replaceWording } from './medicalLiterals'

const simplify = OpenCC.Converter({ from: 't', to: 'cn' })
const stripEnding = (text: string) => text.trim().replace(/[。！？!?；;，,、]+$/u, '')

const normalizeSpeechLayout = (text: string) => text
  .replace(/[\u200b\u200c\u200d]/gu, '')
  .replace(/[\r\n]+/gu, '')
  .replace(/(?<=[\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu, '')
  .replace(/\s+/gu, ' ')

// Browser ASR often adds a leading filler or spaces between each Han character.
// Strip only conversational fillers at the boundary; never remove words inside
// the clinical sentence, where doing so could change meaning.
const normalizeSpeechFiller = (text: string) => text.replace(/^(?:嗯+|呃+|啊+|那个|就是)[\s，,、:：-]*/u, '')

// Script, punctuation and speech-layout equivalence only. Never remove negation,
// uncertainty or quantities from the clinical sentence.
export const normalizeForMatch = (text: string) => {
  const simplified = simplify(normalizeSpeechFiller(normalizeSpeechLayout(text.normalize('NFC'))))
  return stripEnding(simplified)
    .replace(/[，、]/gu, ',')
    .replace(/；/gu, ';')
    .replace(/：/gu, ':')
    .replace(/\s*([,;:])\s*/gu, '$1')
}
export const endingFor = (text: string, reference = '') => /[?？]$/u.test(text.trim()) || /[?？]$/u.test(reference.trim()) ? '？' : /[!！]$/u.test(text.trim()) ? '！' : '。'

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
  return (source: string, dialect: DialectId, direction: Direction): Translation | null => {
    if (!stripEnding(source)) return null
    const single = exact(source, dialect, direction)
    if (single) return single
    // Compose only when EVERY clause is covered, in its original order.
    // Unknown clauses, conjunctions and decimal points are not discarded or guessed.
    const parts = [...source.matchAll(/([^，,。！？!?；;\n]+)([，,。！？!?；;\n]*)/gu)]
    if (parts.length > 1 && parts.map((part) => part[0]).join('') === source) {
      const results = parts.map((part) => exact(part[1], dialect, direction))
      if (results.every((result) => result !== null)) {
        return {
          text: results.map((result, index) => {
            const separator = parts[index][2]
            const punctuation = index === parts.length - 1 || /[。！？!?\n]/u.test(separator)
              ? endingFor(parts[index][0], result.text) : /[；;]/u.test(separator) ? '；' : '，'
            return stripEnding(result.text) + punctuation
          }).join(''),
          pronunciation: '组合短句的完整读音尚待核对。',
          note: '按已收录短句逐句组合，保留原句顺序。请对照原文核对症状、否定和时间；方言表达仍待当地使用者核对。',
          confidence: 'phrase',
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
