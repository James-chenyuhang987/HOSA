import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadConfig } from './config.mjs'

test('allows the local hosted frontend on a custom port', async () => {
  const config = await loadConfig({ HOSA_PORT: '8888', HOSA_ALLOWED_ORIGINS: 'https://example.test' })
  assert.equal(config.port, 8888)
  assert.ok(config.allowedOrigins.includes('http://127.0.0.1:8888'))
  assert.ok(config.allowedOrigins.includes('https://example.test'))
  assert.ok(!config.allowedOrigins.includes('http://127.0.0.1:8787'))
})

test('requires a connection token for non-loopback listening', async () => {
  await assert.rejects(loadConfig({ HOSA_HOST: '0.0.0.0' }))
  const config = await loadConfig({ HOSA_HOST: '0.0.0.0', HOSA_API_TOKEN: 'test-long-connection-token' })
  assert.equal(config.host, '0.0.0.0')
})

test('requires a token even on loopback when public mode is requested', async () => {
  await assert.rejects(loadConfig({ HOSA_PUBLIC_MODE: '1', HOSA_HOST: '127.0.0.1' }))
  const config = await loadConfig({ HOSA_PUBLIC_MODE: '1', HOSA_API_TOKEN: 'test-long-connection-token' })
  assert.equal(config.host, '127.0.0.1')
})

test('rejects invalid ports and request limits before opening a server', async () => {
  await assert.rejects(loadConfig({ HOSA_PORT: '70000' }))
  await assert.rejects(loadConfig({ HOSA_MAX_CONCURRENT: '0' }))
  await assert.rejects(loadConfig({ HOSA_REQUEST_TIMEOUT_MS: '999999' }))
})

test('rejects unsafe public tokens and malformed browser origins', async () => {
  await assert.rejects(loadConfig({ HOSA_PUBLIC_MODE: '1', HOSA_API_TOKEN: 'short-token' }))
  await assert.rejects(loadConfig({ HOSA_PUBLIC_MODE: '1', HOSA_API_TOKEN: `${'a'.repeat(24)}\n` }))
  await assert.rejects(loadConfig({ HOSA_ALLOWED_ORIGINS: 'https://example.test/HOSA/' }))
  await assert.rejects(loadConfig({ HOSA_ALLOWED_ORIGINS: 'https://user:pass@example.test' }))
  const local = await loadConfig({ HOSA_API_TOKEN: 'local-dev-token' })
  assert.equal(local.token, 'local-dev-token')
  const config = await loadConfig({ HOSA_PUBLIC_MODE: '1', HOSA_API_TOKEN: 'test-long-connection-token' })
  assert.equal(config.token, 'test-long-connection-token')
})

test('loads optional local ASR settings without exposing a default remote service', async () => {
  const local = await loadConfig({
    HOSA_ASR_URL: 'http://127.0.0.1:9000/v1',
    HOSA_ASR_MODEL: 'qwen3-asr-1.7b',
    HOSA_ASR_LABEL: 'Qwen3 方言语音',
    HOSA_ASR_TOKEN: 'local-asr-token',
  })
  assert.deepEqual(local.asr, {
    baseUrl: 'http://127.0.0.1:9000/v1',
    model: 'qwen3-asr-1.7b',
    label: 'Qwen3 方言语音',
    token: 'local-asr-token',
  })
  assert.equal((await loadConfig({})).asr, undefined)
})

test('rejects unsafe ASR endpoints and limits', async () => {
  await assert.rejects(loadConfig({ HOSA_ASR_URL: 'http://user:pass@127.0.0.1:9000/v1' }))
  await assert.rejects(loadConfig({ HOSA_ASR_TIMEOUT_MS: '100' }))
  await assert.rejects(loadConfig({ HOSA_ASR_MODEL: `${'x'.repeat(161)}`, HOSA_ASR_URL: 'http://127.0.0.1:9000' }))
})
