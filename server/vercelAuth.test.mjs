import assert from 'node:assert/strict'
import { test } from 'node:test'
import { corsAndAuth } from '../api/_shared.mjs'

function response() {
  return {
    headers: {}, statusCode: 200, body: '',
    setHeader(name, value) { this.headers[name] = value },
    end(body = '') { this.body = String(body) },
  }
}

test('bounds repeated Vercel credential failures and returns retry guidance', () => {
  const config = { token: 'test-vercel-token-at-least-24', allowedOrigins: ['https://example.test'], rateLimitPerMinute: 30 }
  const req = { method: 'GET', headers: { origin: 'https://example.test', authorization: 'Bearer wrong', 'x-forwarded-for': '198.51.100.77' }, socket: {} }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const res = response()
    assert.equal(corsAndAuth(req, res, config), false)
    assert.equal(res.statusCode, 401)
  }
  const limited = response()
  assert.equal(corsAndAuth(req, limited, config), false)
  assert.equal(limited.statusCode, 429)
  assert.equal(limited.headers['Retry-After'], '60')
  assert.deepEqual(JSON.parse(limited.body), { error: 'AUTH_RATE_LIMITED' })
})

