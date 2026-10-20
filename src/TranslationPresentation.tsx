import { useState } from 'react'
import Modal from './Modal'
import type { Translation } from './translationTypes'
import { isCompleteTranslation, resultLabel } from './translationDisplay'
import SpeechPlayback from './SpeechPlayback'
import type { PlaybackLanguage } from './playbackVoice'

export type PresentationData = {
  sourceText: string
  sourceLanguage: string
  targetLanguage: string
  translation: Translation
  confidenceLabel: string
  playbackLanguage?: PlaybackLanguage
}

/** Receives the result captured when opening, so later model responses cannot change it mid-reading. */
export default function TranslationPresentation({ data, onClose }: { data: PresentationData; onClose: () => void }) {
  const [fontSize, setFontSize] = useState(40)
  return <Modal titleId="presentation-title" onClose={onClose} className="presentation-dialog">
    <header className="presentation-header">
      <div className="presentation-heading"><h2 id="presentation-title">请看这句话</h2>
        <button className="dialog-close" type="button" onClick={onClose}>关闭展示</button>
      </div>
      <div className="presentation-controls" role="group" aria-label="展示字号">
        <span>调整字号</span>
        <button type="button" aria-label="缩小字号" disabled={fontSize <= 28} onClick={() => setFontSize((size) => size - 4)}>A−</button>
        <output aria-live="polite" aria-label="当前字号">{fontSize}</output>
        <button type="button" aria-label="放大字号" disabled={fontSize >= 64} onClick={() => setFontSize((size) => size + 4)}>A+</button>
      </div>
    </header>
    <div className="presentation-body">
      <span className="presentation-label">{data.sourceLanguage}原文</span>
      <p className="presentation-source">{data.sourceText}</p>
      <span className="presentation-label">{resultLabel(data.translation, data.targetLanguage)} · {data.confidenceLabel}</span>
      {data.translation.confidence === 'wording' && <p className="incomplete-note">整句尚未完成翻译，以下仅为用词参考。</p>}
      <p className="presentation-translation" style={{ fontSize }}>{data.translation.text}</p>
      {data.playbackLanguage && <SpeechPlayback text={data.translation.text} language={data.playbackLanguage}
        languageLabel={data.targetLanguage} complete={isCompleteTranslation(data.translation)} />}
      <p className="medical-note">药名、剂量和否定语气，请双方再次核对。</p>
    </div>
  </Modal>
}
