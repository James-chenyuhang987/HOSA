import type { DialectId } from './hospitalLexicon'

/**
 * Public speech resources listed for future research; no trained model from
 * these corpora is currently integrated into the offline translator.
 * These are corpora, not browser-ready translation models, so the app never
 * downloads them or sends patient audio to them.
 */
export type DialectSpeechResource = {
  dialect: DialectId | 'mandarin'
  name: string
  url: string
  purpose: string
}

export const dialectSpeechResources: readonly DialectSpeechResource[] = [
  {
    dialect: 'mandarin', name: 'WenetSpeech', url: 'https://github.com/wenet-e2e/wenetspeech',
    purpose: '普通话语音识别语料',
  },
  {
    dialect: 'sichuan', name: 'WenetSpeech-Chuan', url: 'https://github.com/ASLP-lab/WenetSpeech-Chuan',
    purpose: '四川话语音识别语料',
  },
  {
    dialect: 'cantonese', name: 'WenetSpeech-Yue', url: 'https://github.com/ASLP-lab/WenetSpeech-Yue',
    purpose: '粤语语音识别语料与标注',
  },
  {
    dialect: 'shanghai', name: 'WenetSpeech-Wu', url: 'https://github.com/ASLP-lab/WenetSpeech-Wu-Repo',
    purpose: '吴语（含上海话）语音识别语料',
  },
  {
    dialect: 'minnan', name: 'WenetSpeech-Min', url: 'https://github.com/ASLP-lab/WenetSpeech-Min-Repo',
    purpose: '闽南语语音识别语料',
  },
]

export function speechResourceFor(dialect: DialectId | 'mandarin') {
  return dialectSpeechResources.find((resource) => resource.dialect === dialect)
}
