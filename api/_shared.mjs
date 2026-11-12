import { createHash, timingSafeEqual } from 'node:crypto'
import { loadConfig } from '../server/config.mjs'

let configPromise

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
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Vary', 'Origin')
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin)
}

export function corsAndAuth(req, res, config) {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : ''
  setSecurityHeaders(res, origin && config.allowedOrigins.includes(origin) ? origin : undefined)
  if (origin && !config.allowedOrigins.includes(origin)) {
    res.statusCode = 403
    res.end(JSON.stringify({ error: 'ORIGIN_NOT_ALLOWED' }))
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
  const matches = expected && timingSafeEqual(
    createHash('sha256').update(received).digest(),
    createHash('sha256').update(`Bearer ${expected}`).digest(),
  )
  if (!matches) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'UNAUTHORIZED' }))
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
