import { createHash, timingSafeEqual } from 'node:crypto'
import { loadConfig } from '../server/config.mjs'

let configPromise
const authFailures = new Map()
const requestWindows = new Map()
const WINDOW_MS = 60_000
const AUTH_FAILURE_LIMIT = 10
const MAX_TRACKED_KEYS = 2048

function remember(map, key, value) {
  if (!map.has(key) && map.size >= MAX_TRACKED_KEYS) {
    const oldest = map.keys().next().value
    if (oldest !== undefined) map.delete(oldest)
  }
  map.set(key, value)
}

function sourceKey(req) {
  const forwarded = req.headers?.['x-forwarded-for']
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0].trim()
  return firstForwarded || String(req.socket?.remoteAddress || 'unknown')
}

export function getConfig() {
  configPromise ||= loadConfig({
    ...process.env,
    // Vercel functions are not loopback services; require a bearer token.
    HOSA_HOST: process.env.HOSA_HOST || '0.0.0.0',
  })
  return configPromise
}

export function setSecurityHeaders(res, origin) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Vary', 'Origin')
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin)
}

export function corsAndAuth(req, res, config) {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : ''
  setSecurityHeaders(res, origin && config.allowedOrigins.includes(origin) ? origin : undefined)
  if (origin && !config.allowedOrigins.includes(origin)) {
    sendJson(res, 403, { error: 'ORIGIN_NOT_ALLOWED' })
    return false
  }
  if (req.method === 'OPTIONS') {
    if (origin) {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      res.setHeader('Access-Control-Max-Age', '600')
    }
    res.statusCode = 204
    res.end()
    return false
  }
  const expected = config.token || ''
  const received = typeof req.headers.authorization === 'string' ? req.headers.authorization : ''
  const matches = Boolean(expected && timingSafeEqual(
    createHash('sha256').update(received).digest(),
    createHash('sha256').update(`Bearer ${expected}`).digest(),
  ))
  if (!matches) {
    const key = sourceKey(req)
    const now = Date.now()
    const previous = authFailures.get(key)
    const window = previous && now - previous.started < WINDOW_MS ? previous : { started: now, count: 0 }
    window.count += 1
    remember(authFailures, key, window)
    for (const [address, entry] of authFailures) if (now - entry.started >= WINDOW_MS) authFailures.delete(address)
    if (window.count > AUTH_FAILURE_LIMIT) {
      res.setHeader('Retry-After', '60')
      sendJson(res, 429, { error: 'AUTH_RATE_LIMITED' })
      return false
    }
    sendJson(res, 401, { error: 'UNAUTHORIZED' })
    return false
  }
  authFailures.delete(sourceKey(req))
  const now = Date.now()
  const requestKey = `token:${createHash('sha256').update(received).digest('hex')}`
  const previous = requestWindows.get(requestKey)
  const window = previous && now - previous.started < WINDOW_MS ? previous : { started: now, count: 0 }
  window.count += 1
  remember(requestWindows, requestKey, window)
  for (const [key, entry] of requestWindows) if (now - entry.started >= WINDOW_MS) requestWindows.delete(key)
  if (window.count > (config.rateLimitPerMinute || 30)) {
    res.setHeader('Retry-After', '60')
    sendJson(res, 429, { error: 'RATE_LIMITED' })
    return false
  }
  return true
}

export function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body)
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > 8192) throw new Error('TOO_LARGE')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export function errorStatus(error) {
  if (error?.code === 'INVALID_INPUT') return 400
  if (error?.code === 'UNAUTHORIZED') return 401
  if (error?.code === 'ORIGIN_NOT_ALLOWED') return 403
  if (error?.code === 'TIMEOUT') return 504
  if (error?.code === 'CANCELLED') return 499
  return error?.status >= 400 && error.status < 600 ? error.status : 503
}
