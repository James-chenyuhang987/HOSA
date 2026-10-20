import { useState } from 'react'
import type { BackendConnection, ModelHealth, SpeechBackend } from './translationTypes'

type Props = {
  enabled: boolean; disabled: boolean; connection: BackendConnection; checking: boolean
  healthMessage: string; models: ModelHealth[]; asr: SpeechBackend; asrEnabled: boolean
  onAsrModeChange: (enabled: boolean) => void
  onModeChange: (enabled: boolean) => void
  onConnectionChange: (connection: BackendConnection) => void
  onCheck: (probe?: boolean) => void
}

export default function ModelConnection(props: Props) {
  const [draft, setDraft] = useState(props.connection)
  const [saved, setSaved] = useState(false)
  const dirty = draft.url !== props.connection.url || draft.token !== props.connection.token
  return <details className="model-connection" id="translation-settings">
    <summary>翻译设置 <span>{props.enabled ? '模型补译已开启' : '词库翻译'} · {props.asrEnabled ? '本地语音' : '浏览器语音'}</span></summary>
    <div className="settings-content">
      <label className="model-toggle">
        <input type="checkbox" role="switch" checked={props.enabled} disabled={props.disabled}
          onChange={(event) => props.onModeChange(event.target.checked)} />
        <span><strong>使用本地模型补全</strong><small>词库未覆盖的整句，自动交给已配置模型</small></span>
      </label>
      <p className="model-privacy">开启后，输入停顿时文字会发送到当前翻译后端。</p>
      <label className="model-toggle speech-toggle">
        <input type="checkbox" role="switch" checked={props.asrEnabled} disabled={props.disabled}
          onChange={(event) => props.onAsrModeChange(event.target.checked)} />
        <span><strong>优先使用本地语音模型</strong><small>
          {props.asr.configured ? `语音服务已配置：${props.asr.label || '本地 ASR'}（识别效果需实际录音确认）` : '尚未确认语音服务，请先检测连接'}
        </small></span>
      </label>
      <p className="model-privacy">开启后临时录音会发送到当前后端的语音服务，本应用不保存音频。浏览器语音识别是否使用云端由浏览器决定。</p>
      <details>
        <summary>连接设置</summary>
        <div className="model-fields">
          <label htmlFor="backend-url">翻译后端地址</label>
          <input id="backend-url" type="text" value={draft.url} disabled={props.disabled}
            placeholder="http://127.0.0.1:8787/api" spellCheck={false}
            onChange={(event) => { setDraft({ ...draft, url: event.target.value }); setSaved(false) }} />
          <label htmlFor="backend-token">连接凭证（可选）</label>
          <input id="backend-token" type="password" autoComplete="off" value={draft.token}
            disabled={props.disabled} placeholder="只在当前页面使用"
            onChange={(event) => { setDraft({ ...draft, token: event.target.value }); setSaved(false) }} />
          <button className="connection-check" type="button" disabled={!dirty || props.disabled || !draft.url.trim()}
            onClick={() => { const next = { url: draft.url.trim(), token: draft.token }; setDraft(next); props.onConnectionChange(next); setSaved(true) }}>保存并应用</button>
          <p className="connection-message" role="status">{dirty ? '设置尚未应用；保存后再检测连接。' : saved ? '已应用，仅在当前页面使用。' : ''}</p>
          <div className="connection-actions">
            <button className="connection-check" type="button" disabled={props.checking || props.disabled || dirty}
              onClick={() => props.onCheck(false)}>{props.checking ? '检测中…' : '检测连接'}</button>
            <button className="connection-check" type="button" disabled={props.checking || props.disabled || dirty}
              onClick={() => props.onCheck(true)}>检测模型推理</button>
          </div>
          {props.healthMessage && <p className="connection-message" role="status">{props.healthMessage}</p>}
          {props.models.length > 0 && <ul className="model-list">{props.models.map((model) =>
            <li key={model.id}><span>{model.label}</span><small className={model.ready === true ? 'available' : ''}>
              {!model.available ? '未就绪' : model.ready === true ? '推理已验证' : model.ready === false ? '推理失败' : '已发现，待验证'}
            </small></li>)}</ul>}
        </div>
      </details>
    </div>
  </details>
}
