import { describe, expect, it } from 'vitest'
import { hospitalLexicon, hospitalPhrasesFor } from './hospitalLexicon'
import type { DialectId } from './hospitalLexicon'

const dialects: DialectId[] = ['cantonese', 'minnan', 'shanghai', 'sichuan', 'northeast']
const normalized = (value: string) => value.trim().replace(/[。！？!?]+$/u, '')

describe('hospital lexicon integrity', () => {
  it('keeps every input and its aliases unambiguous', () => {
    const owners = new Map<string, string>()
    for (const entry of hospitalLexicon) {
      for (const source of [entry.source, ...(entry.aliases ?? [])]) {
        const key = normalized(source)
        expect(key, `empty source for ${entry.source}`).not.toBe('')
        expect(owners.has(key), `duplicate input ${source}`).toBe(false)
        owners.set(key, entry.source)
      }
    }
  })

  it.each(dialects)('provides complete, unambiguous reverse entries for %s', (dialect) => {
    const meanings = new Set<string>()
    for (const phrase of hospitalPhrasesFor(dialect)) {
      const text = normalized(phrase.text)
      expect(text, `missing translation for ${phrase.source}`).not.toBe('')
      expect(meanings.has(text), `conflicting reverse phrase ${phrase.text}`).toBe(false)
      meanings.add(text)
      expect(phrase.pronunciation.trim()).not.toBe('')
      expect(phrase.note.trim()).not.toBe('')
    }
  })
})
