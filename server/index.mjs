import { createServer } from 'node:http'
import { createHash, timingSafeEqual } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadConfig } from './config.mjs'
import { probeModel, probeModelTranslation, ServiceError, translate, validateInput } from './translator.mjs'
import { readAudioBody, transcribeAudio } from './transcriber.mjs'

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'microphone=(self)',
  'Content-Security-Policy': "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https: http://127.0.0.1:* http://localhost:*",
}

function send(res, status, data) {
  if (res.destroyed) return
  res.writeHead(status, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(data))
}

function authorized(req, token) {
  if (!token) return true
  const value = req.headers.authorization || ''
  return timingSafeEqual(createHash('sha256').update(value).digest(),
    createHash('sha256').update(`Bearer ${token}`).digest())
}

function rateKey(req, token) {
  if (token && req.headers.authorization) {
    return `token:${createHash('sha256').update(req.headers.authorization).digest('hex')}`
  }
  return `ip:${req.socket.remoteAddress || 'unknown'}`
}

async function readInput(req) {
  const rejectBody = (status) => {
    // Drain a rejected keep-alive request so unread bytes cannot pin the socket.
    req.resume()
    throw new ServiceError('INVALID_INPUT', status)
  }
  if (!/^application\/json(?:\s*;|$)/iu.test(req.headers['content-type'] || '')) rejectBody(415)
  const declaredLength = req.headers['content-length']
  if (declaredLength && (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > 8192)) rejectBody(413)
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > 8192) rejectBody(413)
    chunks.push(chunk)
  }
  try { return validateInput(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
  catch { throw new ServiceError('INVALID_INPUT', 400) }
}

async function servePage(req, res, pathname, distDir) {
  if (!['GET', 'HEAD'].includes(req.method)) { send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); return }
  if (pathname === '/' || pathname === '/HOSA') {
    res.writeHead(302, { Location: '/HOSA/' }); res.end(); return
  }
  if (!pathname.startsWith('/HOSA/')) { send(res, 404, { error: 'NOT_FOUND' }); return }
  let relative
  try { relative = decodeURIComponent(pathname.slice('/HOSA/'.length)) }
  catch { send(res, 404, { error: 'NOT_FOUND' }); return }
  let path = resolve(distDir, relative || 'index.html')
  if (!path.startsWith(`${distDir}${sep}`)) { send(res, 404, { error: 'NOT_FOUND' }); return }
  try {
    if (!(await stat(path)).isFile()) throw new Error('not a file')
  } catch {
    // SPA fallback only for extensionless pages; missing assets stay 404.
    if (extname(relative)) { send(res, 404, { error: 'NOT_FOUND' }); return }
    path = resolve(distDir, 'index.html')
  }
  try {
    const content = await readFile(path)
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' }
    res.writeHead(200, { ...securityHeaders, 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
    res.end(req.method === 'HEAD' ? undefined : content)
  } catch { send(res, 404, { error: 'FRONTEND_NOT_BUILT' }) }
}

export function createTranslationServer(config, { fetchImpl = fetch } = {}) {
  let active = 0
  const windows = new Map()
  const authFailures = new Map()
  const queue = []
  const maxConcurrent = config.maxConcurrent ?? 2
  const maxQueue = config.maxQueue ?? 8
  const rateLimitPerMinute = config.rateLimitPerMinute ?? 30
  const authRateLimitPerMinute = Math.max(10, Math.min(rateLimitPerMinute, 60))

  const pump = () => {
    while (active < maxConcurrent && queue.length) {
      const entry = queue.shift()
      if (!entry || entry.cancelled || entry.signal.aborted) {
        entry?.cleanup()
        continue
      }
      entry.running = true
      active += 1
      Promise.resolve().then(entry.task).then(entry.resolve, entry.reject).finally(() => {
        active -= 1
        entry.cleanup()
        pump()
      })
    }
  }

  const schedule = (task, signal) => new Promise((resolve, reject) => {
    const entry = { task, signal, resolve, reject, running: false, cancelled: false, cleanup: () => {} }
    const abort = () => {
      entry.cancelled = true
      if (!entry.running) {
        reject(new ServiceError('CANCELLED', 499))
        entry.cleanup()
        pump()
      }
    }
    signal.addEventListener('abort', abort, { once: true })
    entry.cleanup = () => signal.removeEventListener('abort', abort)
    if (signal.aborted) { abort(); entry.cleanup(); return }
    queue.push(entry)
    pump()
  })

  const server = createServer(async (req, res) => {
    for (const [name, value] of Object.entries(securityHeaders)) res.setHeader(name, value)
    const controller = new AbortController()
    res.on('close', () => { if (!res.writableEnded) controller.abort() })
    try {
      const pathname = new URL(req.url || '/', 'http://localhost').pathname
      if (!pathname.startsWith('/api/')) {
        await servePage(req, res, pathname, config.distDir)
        return
      }
      const origin = req.headers.origin
      if (origin && !config.allowedOrigins.includes(origin)) { send(res, 403, { error: 'ORIGIN_NOT_ALLOWED' }); return }
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin') }
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' })
        res.end(); return
      }
      const now = Date.now()
      for (const [address, window] of authFailures) if (now - window.start >= 60_000) authFailures.delete(address)
      const authAddress = req.socket.remoteAddress || 'unknown'
      const authWindow = authFailures.get(authAddress) || { start: now, count: 0 }
      if (authWindow.count >= authRateLimitPerMinute) { send(res, 429, { error: 'AUTH_RATE_LIMITED' }); return }
      if (!authorized(req, config.token)) {
        authWindow.count += 1
        if (authFailures.size >= 1024 && !authFailures.has(authAddress)) {
          const oldest = authFailures.keys().next().value
          if (oldest) authFailures.delete(oldest)
        }
        authFailures.set(authAddress, authWindow)
        send(res, 401, { error: 'UNAUTHORIZED' }); return
      }
      authFailures.delete(authAddress)
      if (pathname === '/api/health' && req.method === 'GET') {
        const probe = new URL(req.url, 'http://localhost').searchParams.get('probe') === '1'
        const models = await Promise.all(config.models.filter((model) => model.enabled).map(async (model) => {
          const available = await probeModel(model, fetchImpl, controller.signal)
          const ready = probe && available
            ? await probeModelTranslation(model, fetchImpl, controller.signal, config.healthProbeTimeoutMs ?? 15_000)
            : undefined
          return { id: model.id, label: model.label, dialects: model.dialects, available, ...(probe ? { ready } : {}) }
        }))
        send(res, 200, {
          service: 'hosa-translation', models,
          asr: config.asr ? { configured: true, label: config.asr.label, model: config.asr.model } : { configured: false },
        }); return
      }
      if (pathname === '/api/transcribe' && req.method === 'POST') {
        for (const [address, window] of windows) if (now - window.start >= 60_000) windows.delete(address)
        const address = rateKey(req, config.token)
        const window = windows.get(address) || { start: now, count: 0 }
        if (window.count >= rateLimitPerMinute || windows.size >= 1024) { send(res, 429, { error: 'RATE_LIMITED' }); return }
        window.count += 1
        windows.set(address, window)
        const audio = await readAudioBody(req, config.maxAudioBytes ?? 12 * 1024 * 1024)
        const result = await transcribeAudio(audio, config, controller.signal, fetchImpl)
        send(res, 200, result); return
      }
      if (pathname !== '/api/translate') { send(res, 404, { error: 'NOT_FOUND' }); return }
      if (req.method !== 'POST') { send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); return }
      for (const [address, window] of windows) if (now - window.start >= 60_000) windows.delete(address)
      const address = rateKey(req, config.token)
      const window = windows.get(address) || { start: now, count: 0 }
      if (window.count >= rateLimitPerMinute || windows.size >= 1024) { send(res, 429, { error: 'RATE_LIMITED' }); return }
      window.count += 1
      windows.set(address, window)
      const input = await readInput(req)
      if (active >= maxConcurrent && queue.length >= maxQueue) { send(res, 503, { error: 'BUSY' }); return }
      const result = await schedule(() => translate(input, config, controller.signal, fetchImpl), controller.signal)
      send(res, 200, result)
    } catch (error) {
      send(res, error instanceof ServiceError ? error.status : 500,
        { error: error instanceof ServiceError ? error.code : 'INTERNAL_ERROR' })
    }
  })
  server.headersTimeout = 10_000
  server.requestTimeout = Math.max(15_000, config.requestTimeoutMs ?? 60_000, (config.asrTimeoutMs ?? 45_000) + 5_000)
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const config = await loadConfig()
    const server = createTranslationServer(config)
    server.on('error', (error) => { console.error(`后端启动失败：${error.code || 'UNKNOWN'}`); process.exitCode = 1 })
    server.listen(config.port, config.host, () => {
      console.log(`诊途翻译后端：http://${config.host}:${config.port}/api`)
      console.log(`本地页面：http://${config.host}:${config.port}/HOSA/（先执行 npm run build）`)
      console.log(`已启用模型：${config.models.filter((model) => model.enabled).map((model) => model.label).join('、') || '暂无'}`)
    })
  } catch {
    console.error('后端配置无法读取或校验失败，请检查 server/.env 与模型配置；公网分享或非本机监听需要连接凭证。')
    process.exitCode = 1
  }
}
