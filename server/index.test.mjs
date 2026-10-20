import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolve } from 'node:path'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createTranslationServer } from './index.mjs'
import { validateModelConfig } from './config.mjs'

const request = { text: '今天又吐了。', dialect: 'cantonese', direction: 'toDialect' }
async function fixture(t, overrides = {}, fetchImpl = async () => Response.json({ message: { content: '今日又呕咗。' } })) {
  const config = {
    ...validateModelConfig({ models: [{ id: 'hy', label: '测试模型', enabled: true, runtime: 'ollama', profile: 'hy-mt', baseUrl: 'http://127.0.0.1:11434', model: 'test' }],
      routes: { cantonese: ['hy'], minnan: [], shanghai: [], sichuan: [], northeast: [] } }),
    token: '', allowedOrigins: ['http://localhost:5173'], maxConcurrent: 1, distDir: resolve('dist'),
    requestTimeoutMs: 1000, providerTimeoutMs: 1000, ...overrides,
  }
  const server = createTranslationServer(config, { fetchImpl })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  t.after(async () => { server.closeAllConnections(); await new Promise((done) => server.close(done)) })
  return `http://127.0.0.1:${server.address().port}/api`
}
const post = (base, body = request, headers = {}) => fetch(`${base}/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })

test('serves translation JSON with no-store and an allowed CORS origin', async (t) => {
  const base = await fixture(t)
  const response = await post(base, request, { Origin: 'http://localhost:5173' })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  assert.deepEqual(await response.json(), { text: '今日又呕咗。', provider: '测试模型', providerId: 'hy', needsReview: true })
})

test('rejects untrusted browser origins and missing backend tokens', async (t) => {
  const base = await fixture(t, { token: 'test-connection-token' })
  assert.equal((await post(base, request, { Origin: 'https://attacker.test' })).status, 403)
  assert.equal((await post(base)).status, 401)
  assert.equal((await post(base, request, { Authorization: 'Bearer test-connection-token' })).status, 200)
  assert.equal((await fetch(`${base}/translate`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } })).status, 204)
})

test('limits repeated failed credential attempts by source address', async (t) => {
  const base = await fixture(t, { token: 'test-connection-token', rateLimitPerMinute: 1 })
  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal((await post(base, request, { Authorization: 'Bearer wrong-connection-token' })).status, 401)
  }
  assert.equal((await post(base, request, { Authorization: 'Bearer wrong-connection-token' })).status, 429)
})

test('rejects malformed JSON, client model selection and excessive request size', async (t) => {
  const base = await fixture(t)
  assert.equal((await post(base, { ...request, model: 'untrusted' })).status, 400)
  assert.equal((await fetch(`${base}/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400)
  assert.equal((await post(base, { ...request, text: '字'.repeat(5000) })).status, 413)
  assert.equal((await fetch(`${base}/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(9000) })).status, 413)
})

test('health distinguishes an installed model from an unavailable one without returning endpoints or keys', async (t) => {
  const base = await fixture(t, {}, async () => Response.json({ models: [{ name: 'test:latest' }] }))
  const data = await (await fetch(`${base}/health`)).json()
  assert.equal(data.models[0].available, true)
  assert.equal(data.models[0].baseUrl, undefined)
  assert.equal(data.models[0].apiKeyEnv, undefined)
})

test('accepts a bounded recording and proxies it to the configured ASR without exposing its endpoint', async (t) => {
  const boundary = 'hosa-index-audio'
  const audioBody = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="voice.webm"\r\n` +
    'Content-Type: audio/webm\r\n\r\nAUDIO\r\n' +
    `--${boundary}--\r\n`,
  )
  let upstreamUrl = ''
  const base = await fixture(t, {
    asr: { baseUrl: 'http://127.0.0.1:9000/v1', model: 'qwen3-asr-1.7b', label: '测试 ASR', token: 'asr-secret' },
    asrTimeoutMs: 1000, maxAudioBytes: 1024,
  }, async (url, options) => {
    upstreamUrl = url
    assert.equal(options.headers.Authorization, 'Bearer asr-secret')
    return Response.json({ text: '你好' })
  })
  const response = await fetch(`${base}/transcribe`, {
    method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body: audioBody,
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { text: '你好', provider: '测试 ASR' })
  assert.equal(upstreamUrl, 'http://127.0.0.1:9000/v1/audio/transcriptions')
})

test('limits concurrent model requests', async (t) => {
  let release
  let started
  const began = new Promise((done) => { started = done })
  const base = await fixture(t, { maxQueue: 0 }, async () => {
    started()
    await new Promise((done) => { release = done })
    return Response.json({ message: { content: '今日又呕咗。' } })
  })
  const first = post(base)
  await began
  assert.equal((await post(base)).status, 503)
  release()
  assert.equal((await first).status, 200)
})

test('cancels upstream inference when the frontend disconnects', async (t) => {
  let begin
  let cancelled
  const started = new Promise((done) => { begin = done })
  const ended = new Promise((done) => { cancelled = done })
  const base = await fixture(t, {}, async (_url, options) => {
    begin()
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => {
      cancelled(); reject(options.signal.reason)
    }, { once: true }))
  })
  const controller = new AbortController()
  const result = fetch(`${base}/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: controller.signal })
  await started
  controller.abort()
  await assert.rejects(result)
  await ended
})

test('hosts the built frontend without exposing config files or masking missing assets', async (t) => {
  const distDir = await mkdtemp(resolve(tmpdir(), 'hosa-static-test-'))
  t.after(() => rm(distDir, { recursive: true, force: true }))
  await writeFile(resolve(distDir, 'index.html'), '<main>诊途</main>')
  await mkdir(resolve(distDir, 'assets'))
  await writeFile(resolve(distDir, 'assets/app.js'), 'export {}')
  const base = (await fixture(t, { distDir })).replace('/api', '')
  const page = await fetch(`${base}/HOSA/`)
  assert.match(page.headers.get('content-type'), /text\/html/u)
  assert.equal(await page.text(), '<main>诊途</main>')
  assert.equal((await fetch(`${base}/HOSA/assets/app.js`)).status, 200)
  assert.equal((await fetch(`${base}/HOSA/assets/missing.js`)).status, 404)
  assert.equal((await fetch(`${base}/server/models.local.json`)).status, 404)
  assert.equal((await fetch(`${base}/HOSA/..%2fserver%2fmodels.local.json`)).status, 404)
  assert.equal((await fetch(`${base}/HOSA/%E0%A4%A`)).status, 404)
})
