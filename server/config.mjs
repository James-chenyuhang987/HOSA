import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export const dialects = ['cantonese', 'minnan', 'shanghai', 'sichuan', 'northeast']
const profileDialects = {
  'hy-mt': ['cantonese'], milmmt: ['cantonese'], taigi: ['minnan'], general: dialects,
}

const SAFE_TOKEN = /^[\x21-\x7e]{1,256}$/u

function validateToken(token, required) {
  if (!token) {
    if (required) throw new Error('公网分享或非本机监听时，请设置至少 24 字符的 HOSA_API_TOKEN。')
    return
  }
  if (!SAFE_TOKEN.test(token) || (required && token.length < 24)) {
    throw new Error(required
      ? 'HOSA_API_TOKEN 只能使用 24 到 256 个可打印字符，不能包含空格或换行。'
      : 'HOSA_API_TOKEN 只能使用最多 256 个可打印字符，不能包含空格或换行。')
  }
}

function parseOrigins(value) {
  const origins = new Set()
  for (const raw of value.split(',')) {
    const input = raw.trim()
    if (!input) continue
    let origin
    try { origin = new URL(input) }
    catch { throw new Error('HOSA_ALLOWED_ORIGINS 需要完整的 http/https 来源地址。') }
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password
      || origin.pathname !== '/' || origin.search || origin.hash) {
      throw new Error('HOSA_ALLOWED_ORIGINS 需要不带路径、查询参数或凭证的 http/https 来源。')
    }
    origins.add(origin.origin)
  }
  return origins
}

export function validateModelConfig(data) {
  if (!data || !Array.isArray(data.models) || data.models.length > 20 || !data.routes) {
    throw new Error('模型配置需要 models 数组与 routes。')
  }
  const ids = new Set()
  const models = data.models.map((entry) => {
    if (!entry || !/^[a-z][a-z0-9-]{0,40}$/u.test(entry.id) || ids.has(entry.id)
      || !['ollama', 'openai'].includes(entry.runtime) || !Object.hasOwn(profileDialects, entry.profile)
      || typeof entry.label !== 'string' || !entry.label.trim() || entry.label.length > 80
      || typeof entry.model !== 'string' || !entry.model.trim() || entry.model.length > 200
      || typeof entry.enabled !== 'boolean'
      || (entry.apiKeyEnv && !/^[A-Z][A-Z0-9_]{0,100}$/u.test(entry.apiKeyEnv))) {
      throw new Error('模型 id、运行方式、模板、名称或 enabled 配置不合法。')
    }
    const url = new URL(entry.baseUrl)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('模型 baseUrl 需要无内嵌凭证的 http/https 地址。')
    }
    ids.add(entry.id)
    return { ...entry, baseUrl: url.href.replace(/\/+$/u, ''), dialects: profileDialects[entry.profile] }
  })
  const routes = {}
  for (const dialect of dialects) {
    const route = data.routes[dialect]
    if (!Array.isArray(route) || new Set(route).size !== route.length
      || route.some((id) => !ids.has(id) || !models.find((model) => model.id === id).dialects.includes(dialect))) {
      throw new Error(`${dialect} 路由包含未知、重复或不支持该方言的模型。`)
    }
    routes[dialect] = route
  }
  return { models, routes }
}

function integer(env, name, fallback, min, max) {
  const value = Number(env[name] ?? fallback)
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} 超出允许范围。`)
  return value
}

function optionalUrl(value, name) {
  if (!value) return undefined
  let url
  try { url = new URL(value) }
  catch { throw new Error(`${name} 需要完整的 http/https 地址。`) }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} 需要无凭证、查询参数或片段的 http/https 地址。`)
  }
  return url.href.replace(/\/+$/u, '')
}

export async function loadConfig(env = process.env) {
  let data
  const configPath = env.HOSA_MODEL_CONFIG || 'server/models.local.json'
  try {
    data = await readFile(resolve(configPath), 'utf8')
  } catch (error) {
    if (env.HOSA_MODEL_CONFIG || error.code !== 'ENOENT') throw error
    data = await readFile(new URL('./models.example.json', import.meta.url), 'utf8')
  }
  const host = env.HOSA_HOST || '127.0.0.1'
  const token = env.HOSA_API_TOKEN || ''
  validateToken(token, env.HOSA_PUBLIC_MODE === '1' || !['127.0.0.1', 'localhost', '::1'].includes(host))
  const port = integer(env, 'HOSA_PORT', 8787, 1, 65535)
  const asrUrl = optionalUrl(env.HOSA_ASR_URL?.trim(), 'HOSA_ASR_URL')
  const asrToken = env.HOSA_ASR_TOKEN || ''
  validateToken(asrToken, false)
  const asr = asrUrl ? {
    baseUrl: asrUrl,
    model: env.HOSA_ASR_MODEL?.trim() || 'qwen3-asr-1.7b',
    label: env.HOSA_ASR_LABEL?.trim() || '本地方言语音模型',
    token: asrToken,
  } : undefined
  if (asr && (!/^[^\r\n]{1,160}$/u.test(asr.model) || !/^.{1,80}$/su.test(asr.label))) {
    throw new Error('HOSA_ASR_MODEL 或 HOSA_ASR_LABEL 配置不合法。')
  }
  const allowedOrigins = parseOrigins(env.HOSA_ALLOWED_ORIGINS
    || 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173')
  for (const hostname of ['127.0.0.1', 'localhost', '[::1]']) allowedOrigins.add(`http://${hostname}:${port}`)
  return {
    ...validateModelConfig(JSON.parse(data)), host, token,
    port,
    asr,
    asrTimeoutMs: integer(env, 'HOSA_ASR_TIMEOUT_MS', 45_000, 1_000, 80_000),
    maxAudioBytes: integer(env, 'HOSA_MAX_AUDIO_BYTES', 12 * 1024 * 1024, 64 * 1024, 20 * 1024 * 1024),
    requestTimeoutMs: integer(env, 'HOSA_REQUEST_TIMEOUT_MS', 60_000, 1000, 80_000),
    providerTimeoutMs: integer(env, 'HOSA_PROVIDER_TIMEOUT_MS', 25_000, 1000, 80_000),
    maxConcurrent: integer(env, 'HOSA_MAX_CONCURRENT', 2, 1, 20),
    maxQueue: integer(env, 'HOSA_MAX_QUEUE', 8, 0, 100),
    rateLimitPerMinute: integer(env, 'HOSA_RATE_LIMIT_PER_MINUTE', 30, 1, 10_000),
    healthProbeTimeoutMs: integer(env, 'HOSA_HEALTH_PROBE_TIMEOUT_MS', 15_000, 1_000, 30_000),
    allowedOrigins: [...allowedOrigins],
    distDir: resolve('dist'),
  }
}
