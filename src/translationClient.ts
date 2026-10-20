import type { BackendConnection, BackendHealth, ModelHealth, Translation, TranslationRequest } from './translationTypes'

export const defaultBackendUrl = import.meta.env.VITE_TRANSLATION_API_URL || '/api'

function apiUrl(base: string, path: string) {
  const value = base.trim().replace(/\/+$/u, '')
  if (/^\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+$/iu.test(value)) return `${value}/${path}`
  try {
    const url = new URL(value)
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash) {
      return `${url.href.replace(/\/+$/u, '')}/${path}`
    }
  } catch {
    // Invalid addresses use the same actionable message as unsupported URL schemes.
  }
  throw new Error('请填写 http 或 https 后端地址，例如 http://127.0.0.1:8787/api。')
}

function headers(connection: BackendConnection) {
  return {
    'Content-Type': 'application/json',
    ...(connection.token ? { Authorization: `Bearer ${connection.token}` } : {}),
  }
}

function authHeaders(connection: BackendConnection) {
  const result: Record<string, string> = {}
  if (connection.token) result.Authorization = `Bearer ${connection.token}`
  return result
}

async function responseJson(response: Response) {
  let data: unknown
  try { data = await response.json() }
  catch { throw new Error('后端没有返回可读取的数据，请检查地址与服务状态。') }
  if (!response.ok) {
    const code = data && typeof data === 'object' && 'error' in data ? data.error : ''
    const messages: Record<string, string> = {
      UNAUTHORIZED: '连接凭证不正确，请检查连接设置。',
      ORIGIN_NOT_ALLOWED: '后端未允许当前页面连接，请检查允许的前端来源。',
      NO_PROVIDER: '这个方言还没有配置可用模型。',
      MODELS_UNAVAILABLE: '模型暂时不可用，已保留词库参考；可先检测连接。',
      TRANSLATION_UNVERIFIED: '模型译文未通过完整性检查，已保留词库参考；请分成短句后重试。',
      TIMEOUT: '模型响应超时，已保留词库参考。',
      BUSY: '模型正在处理其他请求，请稍后再试。',
      RATE_LIMITED: '请求过于频繁，请稍后再试。',
      AUTH_RATE_LIMITED: '凭证尝试次数过多，请稍后再试。',
      CANCELLED: '当前请求已取消。',
      INVALID_INPUT: '输入内容不符合要求，请使用 240 字以内的完整句子。',
      ASR_NOT_CONFIGURED: '本地语音服务尚未就绪，请在翻译设置中检测连接，或改用浏览器重新录音。',
      INVALID_AUDIO: '录音格式无法读取，请重试或改用浏览器语音识别。',
      EMPTY_AUDIO: '没有录到有效声音，请靠近麦克风后重试。',
      AUDIO_TOO_LARGE: '录音文件过大，请缩短录音后重试。',
      ASR_UNAVAILABLE: '本地语音服务暂时不可用，请重试或改用浏览器重新录音。',
      ASR_INVALID_RESPONSE: '语音服务没有返回可用文字，请重新录音或改用文字输入。',
      ASR_TIMEOUT: '语音识别等待超时，请缩短录音后重试。',
    }
    throw new Error(messages[String(code)] || '翻译服务暂时不可用，已保留词库参考。')
  }
  return data
}

export async function requestModelTranslation(
  input: TranslationRequest,
  connection: BackendConnection,
  signal: AbortSignal,
): Promise<Translation> {
  const response = await fetch(apiUrl(connection.url, 'translate'), {
    method: 'POST', headers: headers(connection), body: JSON.stringify(input),
    signal: AbortSignal.any([signal, AbortSignal.timeout(90_000)]),
    credentials: 'omit', cache: 'no-store',
  })
  const data = await responseJson(response)
  if (!data || typeof data !== 'object' || !('text' in data) || typeof data.text !== 'string'
    || !data.text.trim() || data.text.length > 2000 || !('provider' in data)
    || typeof data.provider !== 'string' || !data.provider.trim() || data.provider.length > 80
    || !('needsReview' in data) || data.needsReview !== true) {
    throw new Error('模型返回内容无法确认，已保留词库参考。')
  }
  return {
    text: data.text,
    pronunciation: '模型译文暂不生成读音，请让当地使用者核对。',
    note: '这是模型生成的表达，尚未经过人工核对。药名、剂量、症状及否定语气请与原文逐项确认。',
    confidence: 'model', provider: data.provider,
  }
}

export async function requestTranscription(
  blob: Blob,
  connection: BackendConnection,
  signal: AbortSignal,
): Promise<{ text: string; provider?: string }> {
  const body = new FormData()
  body.append('file', blob, `hosa-recording.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`)
  const response = await fetch(apiUrl(connection.url, 'transcribe'), {
    method: 'POST', headers: authHeaders(connection), body,
    signal: AbortSignal.any([signal, AbortSignal.timeout(90_000)]),
    credentials: 'omit', cache: 'no-store',
  })
  const data = await responseJson(response)
  if (!data || typeof data !== 'object' || !('text' in data) || typeof data.text !== 'string'
    || !data.text.trim()) {
    throw new Error('语音服务没有返回可用文字，请重新录音或改用文字输入。')
  }
  if (data.text.length > 240) throw new Error('识别文字超过 240 字，请分成短句重新录音。')
  return {
    text: data.text.trim(),
    provider: 'provider' in data && typeof data.provider === 'string' ? data.provider : undefined,
  }
}

export async function checkBackend(connection: BackendConnection, signal: AbortSignal, probe = false): Promise<BackendHealth> {
  const response = await fetch(`${apiUrl(connection.url, 'health')}${probe ? '?probe=1' : ''}`, {
    headers: headers(connection), signal: AbortSignal.any([signal, AbortSignal.timeout(probe ? 40_000 : 10_000)]),
    credentials: 'omit', cache: 'no-store',
  })
  const data = await responseJson(response)
  if (!data || typeof data !== 'object' || !('service' in data) || data.service !== 'hosa-translation'
    || !('models' in data) || !Array.isArray(data.models)) {
    throw new Error('这个地址未返回诊途翻译服务，请检查后端地址。')
  }
  const models = data.models.filter((model): model is ModelHealth => model && typeof model === 'object'
    && typeof model.id === 'string' && typeof model.label === 'string'
    && typeof model.available === 'boolean' && Array.isArray(model.dialects))
  const rawAsr: unknown = 'asr' in data ? data.asr : undefined
  const asr = rawAsr && typeof rawAsr === 'object' && 'configured' in rawAsr && rawAsr.configured === true
    ? {
      configured: true,
      label: 'label' in rawAsr && typeof rawAsr.label === 'string' ? rawAsr.label : undefined,
      model: 'model' in rawAsr && typeof rawAsr.model === 'string' ? rawAsr.model : undefined,
    }
    : { configured: false }
  return { models, asr }
}

export function modelErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === 'TimeoutError') return '连接超时，已保留词库参考。'
  if (error instanceof TypeError) return '暂时连不上本地翻译服务，请启动后端并检查连接地址。'
  return error instanceof Error ? error.message : '模型暂时不可用，已保留词库参考。'
}
