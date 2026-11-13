import { useState } from 'react'
import type { BackendConnection, ModelHealth, SpeechBackend } from './translationTypes'
import { dialectSpeechResources } from './dialectResources'
import { isKnownBackendUrl, isRemoteBackendUrl, validateBackendConnection } from './translationClient'

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
  const [securityMessage, setSecurityMessage] = useState('')
  const [confirmedRemote, setConfirmedRemote] = useState(false)
  const dirty = draft.url !== props.connection.url || draft.token !== props.connection.token
  const remote = isRemoteBackendUrl(draft.url)
  const requiresConfirmation = remote && !isKnownBackendUrl(draft.url)
  const saveConnection = () => {
    const next = { url: draft.url.trim(), token: draft.token }
    const message = validateBackendConnection(next)
    if (message) { setSecurityMessage(message); setSaved(false); return }
    if (requiresConfirmation && !confirmedRemote) {
      setSecurityMessage('这是自定义远程地址。为防止 Token 被发送到假服务器，请确认这是你控制的 HTTPS 后端。')
      setSaved(false)
      return
    }
    setSecurityMessage('')
    setDraft(next)
    props.onConnectionChange(next)
    setSaved(true)
  }
  return <details className="model-connection" id="translation-settings">
    <summary>翻译设置 <span>{props.enabled ? '模型补译已开启' : '词库翻译'} · {props.asrEnabled ? '本地语音' : '浏览器语音'}</span></summary>
    <div className="settings-content">
      <label className="model-toggle">
        <input type="checkbox" role="switch" checked={props.enabled} disabled={props.disabled}
          onChange={(event) => props.onModeChange(event.target.checked)} />
        <span><strong>使用本地模型补全</strong><small>词库未覆盖的整句，自动交给已配置模型</small></span>
      </label>
      <p className="model-privacy">这是可选增强项。GitHub Pages 的离线医院词库不需要你的电脑运行服务器；开启后才会把未覆盖整句发送到已配置服务。</p>
      <label className="model-toggle speech-toggle">
        <input type="checkbox" role="switch" checked={props.asrEnabled} disabled={props.disabled}
          onChange={(event) => props.onAsrModeChange(event.target.checked)} />
        <span><strong>优先使用本地语音模型</strong><small>
          {props.asr.configured ? `语音服务已配置：${props.asr.label || '本地 ASR'}（识别效果需实际录音确认）` : '尚未确认语音服务，请先检测连接'}
        </small></span>
      </label>
      <p className="model-privacy">开启后临时录音会发送到当前后端的语音服务，本应用不保存音频。浏览器语音识别是否使用云端由浏览器决定。</p>
      <details className="speech-resources">
        <summary>方言语音资料</summary>
        <p>截图中的 WenetSpeech 系列是公开语音语料，不是可以直接嵌入网页的翻译模型。这里用于说明方言识别覆盖与词形参考；应用不会自动下载语料或上传医疗录音。</p>
        <ul>{dialectSpeechResources.map((resource) => <li key={resource.name}>
          <a href={resource.url} target="_blank" rel="noreferrer">{resource.name}</a><span>{resource.purpose}</span>
        </li>)}</ul>
      </details>
      <details>
        <summary>连接设置</summary>
        <div className="model-fields">
          <label htmlFor="backend-url">翻译后端地址</label>
          <input id="backend-url" type="text" value={draft.url} disabled={props.disabled}
            placeholder="https://hosa-translation-api.vercel.app/api" spellCheck={false}
            onChange={(event) => { setDraft({ ...draft, url: event.target.value }); setSaved(false); setSecurityMessage(''); setConfirmedRemote(false) }} />
          <small className="connection-hint">GitHub Pages 使用 Vercel 后端时，请填写后端地址末尾的 <code>/api</code>。</small>
          <label htmlFor="backend-token">{draft.url.includes('vercel.app') ? '连接凭证（Vercel 后端必填）' : '连接凭证（可选）'}</label>
          <input id="backend-token" type="password" autoComplete="off" value={draft.token}
            disabled={props.disabled} placeholder="只在当前页面使用"
            onChange={(event) => { setDraft({ ...draft, token: event.target.value }); setSaved(false); setSecurityMessage('') }} />
          {requiresConfirmation && <label className="security-confirm"><input type="checkbox" checked={confirmedRemote}
            onChange={(event) => { setConfirmedRemote(event.target.checked); setSecurityMessage('') }} />
            <span>我确认这是我控制的 HTTPS 后端，允许本页面向它发送 HOSA_API_TOKEN。</span></label>}
          <p className="token-safety-note">安全提示：不要把 DeepSeek API Key 填在这里。Token 只保存在当前页面内存，不会写入 GitHub、URL 或浏览器存储。</p>
          <button className="connection-check" type="button" disabled={!dirty || props.disabled || !draft.url.trim()}
            onClick={saveConnection}>保存并应用</button>
          <p className="connection-message" role="status">{securityMessage || (dirty ? '设置尚未应用；保存后再检测连接。' : saved ? '已应用，仅在当前页面使用。' : '')}</p>
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
