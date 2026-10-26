import type { Translation, TranslationConfidence } from './translationTypes'

export const confidenceLabels: Record<TranslationConfidence, string> = {
  phrase: '常用短句', template: '医院句式 · 待核对', wording: '词语参考', unmatched: '原文 · 尚未翻译', model: '模型生成 · 待核对',
}

export const isCompleteTranslation = (translation: Translation) => ['phrase', 'template', 'model'].includes(translation.confidence)

export function resultLabel(translation: Translation, target: string) {
  if (translation.confidence === 'unmatched') return '原文参考'
  if (translation.confidence === 'wording') return `${target}用词参考`
  return `${target}译文`
}
