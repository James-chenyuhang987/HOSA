import type { DialectId } from './hospitalLexicon'

export type Direction = 'toDialect' | 'toMandarin'
export type TranslationConfidence = 'phrase' | 'template' | 'wording' | 'unmatched' | 'model'
export type Translation = {
  text: string
  pronunciation: string
  note: string
  confidence: TranslationConfidence
  provider?: string
}

export type TranslationRequest = { text: string; dialect: DialectId; direction: Direction }
export type BackendConnection = { url: string; token: string }
export type ModelHealth = {
  id: string
  label: string
  available: boolean
  ready?: boolean
  dialects: DialectId[]
}
export type SpeechBackend = {
  configured: boolean
  label?: string
  model?: string
}
export type BackendHealth = {
  models: ModelHealth[]
  asr: SpeechBackend
}
