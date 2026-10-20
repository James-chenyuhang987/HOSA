import type { DialectId } from './hospitalLexicon'

export type PlaybackLanguage = DialectId | 'mandarin'

// Never substitute Mandarin for a dialect or send medical text to a remote voice.
export function matchingVoice(voices: SpeechSynthesisVoice[], language: PlaybackLanguage) {
  return voices.find((voice) => {
    if (!voice.localService) return false
    const locale = voice.lang.replaceAll('_', '-').toLowerCase()
    if (language === 'cantonese') return /^yue(?:-|$)|^zh-(?:hant-)?hk(?:-|$)/u.test(locale)
    if (language === 'mandarin') return /^(?:cmn(?:-|$)|zh$|zh-(?:cn|hans)(?:-|$))/u.test(locale)
    return false
  })
}
