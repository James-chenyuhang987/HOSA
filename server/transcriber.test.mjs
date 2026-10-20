import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readAudioBody, transcribeAudio } from './transcriber.mjs'

function multipart() {
  const boundary = 'hosa-test-boundary'
  const body = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="voice.webm"\r\n` +
    'Content-Type: audio/webm\r\n\r\nAUDIO-BYTES\r\n' +
    `--${boundary}--\r\n`,
  )
  return { boundary, body }
}

function request(body, contentType) {
  return {
    headers: { 'content-type': contentType, 'content-length': String(body.length) },
    resume() {},
    async *[Symbol.asyncIterator]() { yield body },
  }
}

test('extracts a file from a multipart recording without decoding its bytes', async () => {
  const { boundary, body } = multipart()
  const result = await readAudioBody(request(body, `multipart/form-data; boundary=${boundary}`), 1024)
  assert.equal(result.file.filename, 'voice.webm')
  assert.equal(result.file.mime, 'audio/webm')
  assert.equal(result.file.content.toString(), 'AUDIO-BYTES')
})

test('rejects missing and oversized recordings before ASR forwarding', async () => {
  const { boundary, body } = multipart()
  await assert.rejects(
    readAudioBody(request(body, `multipart/form-data; boundary=${boundary}`), 4),
    (error) => error.code === 'AUDIO_TOO_LARGE' && error.status === 413,
  )
  await assert.rejects(
    readAudioBody(request(Buffer.from('not multipart'), 'audio/webm'), 1024),
    (error) => error.code === 'INVALID_AUDIO' && error.status === 400,
  )
})

test('forwards a normalized OpenAI transcription request to the configured ASR', async () => {
  const { boundary, body } = multipart()
  const audio = await readAudioBody(request(body, `multipart/form-data; boundary=${boundary}`), 1024)
  let forwarded
  const result = await transcribeAudio(audio, {
    asr: { baseUrl: 'http://127.0.0.1:9000/v1', model: 'qwen3-asr-1.7b', label: '测试 ASR', token: 'secret' },
    asrTimeoutMs: 1000,
  }, new AbortController().signal, async (url, options) => {
    forwarded = { url, options }
    return Response.json({ text: '我听不清医生说什么' })
  })
  assert.deepEqual(result, { text: '我听不清医生说什么', provider: '测试 ASR' })
  assert.equal(forwarded.url, 'http://127.0.0.1:9000/v1/audio/transcriptions')
  assert.equal(forwarded.options.headers.Authorization, 'Bearer secret')
  assert.match(String(forwarded.options.body), /qwen3-asr-1.7b/u)
})

test('requires an explicitly configured ASR service', async () => {
  const { boundary, body } = multipart()
  const audio = await readAudioBody(request(body, `multipart/form-data; boundary=${boundary}`), 1024)
  await assert.rejects(
    transcribeAudio(audio, { asrTimeoutMs: 1000 }, new AbortController().signal),
    (error) => error.code === 'ASR_NOT_CONFIGURED' && error.status === 503,
  )
})
