import { useState } from 'react'
import type { Translation, TranslationRequest } from './translationTypes'
import { confidenceLabels, resultLabel } from './translationDisplay'

export type ConversationTurn = {
  id: number; request: TranslationRequest; translation: Translation; sourceLanguage: string; targetLanguage: string
}

export default function ConversationHistory({ turns, onShow, onEdit, onClear }: {
  turns: ConversationTurn[]; onShow: (turn: ConversationTurn) => void
  onEdit: (turn: ConversationTurn) => void; onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  return <details className="conversation-history" id="conversation-history" open={open}>
    <summary onClick={(event) => { event.preventDefault(); setOpen(!open) }}>本页对话 <span>{turns.length ? `${turns.length} 句` : '暂无记录'}</span></summary>
    {open && <>
    <div className="conversation-history-heading"><p>仅在本页保留最近 20 句，刷新即清除。</p>
      {turns.length > 0 && <button type="button" onClick={onClear}>结束并清空对话</button>}
    </div>
    {!turns.length && <p className="conversation-empty">切换说话方或开始下一句时，本句会留在这里。</p>}
    <ol aria-label="本页对话记录">
      {turns.map((turn, index) => <li key={turn.id}>
        <div className="conversation-turn-heading"><strong>{index + 1} · {turn.request.direction === 'toDialect' ? '我说' : '对方说'}{turn.sourceLanguage}</strong>
          <span>{confidenceLabels[turn.translation.confidence]}</span></div>
        <p className="conversation-source">{turn.request.text}</p>
        <p className="conversation-target"><span>{resultLabel(turn.translation, turn.targetLanguage)}</span>{turn.translation.text}</p>
        <div className="conversation-turn-actions">
          <button type="button" onClick={() => onShow(turn)} aria-label={`放大第 ${index + 1} 句`}>放大查看</button>
          <button type="button" onClick={() => onEdit(turn)} aria-label={`编辑第 ${index + 1} 句原文`}>编辑原文</button>
        </div>
      </li>)}
    </ol>
    </>}
  </details>
}
