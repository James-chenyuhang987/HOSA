import { randomUUID } from 'node:crypto'
import { ServiceError } from './translator.mjs'

const MAX_JSON_BYTES = 16_384

function boundaryFrom(contentType) {
  const match = /^multipart\/form-data\s*;\s*boundary=(?:"([^"]+)"|([^;\s]+))/iu.exec(contentType || '')
  const boundary = match?.[1] || match?.[2] || ''
  if (!boundary || boundary.length > 180 || /[^\x21-\x7e]/u.test(boundary)) {
    throw new ServiceError('INVALID_AUDIO', 400)
  }
  return boundary
}

export async function readAudioBody(req, maxBytes) {
  const contentType = req.headers['content-type'] || ''
  if (!/^multipart\/form-data\s*;/iu.test(contentType)) {
    req.resume()
    throw new ServiceError('INVALID_AUDIO', 400)
  }
  const boundary = boundaryFrom(contentType)
  const declaredLength = req.headers['content-length']
  if (declaredLength && (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > maxBytes)) {
    req.resume()
    throw new ServiceError('AUDIO_TOO_LARGE', 413)
  }
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) {
      req.resume()
      throw new ServiceError('AUDIO_TOO_LARGE', 413)
    }
    chunks.push(chunk)
  }
  const body = Buffer.concat(chunks)
  const file = extractFile(body, boundary)
  return { body, contentType, file }
}

function extractFile(body, boundary) {
  const marker = Buffer.from(`--${boundary}`)
  let cursor = body.indexOf(marker)
  while (cursor >= 0) {
    const partStart = cursor + marker.length
    if (body.subarray(partStart, partStart + 2).toString() === '--') break
    const next = body.indexOf(marker, partStart)
    if (next < 0) break
    const part = body.subarray(partStart, next)
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'))
    if (headerEnd >= 0) {
      const headers = part.subarray(0, headerEnd).toString('utf8')
      const disposition = /content-disposition:\s*form-data;[^\r\n]*\bname="([^"]+)"[^\r\n]*/iu.exec(headers)
      if (disposition?.[1] === 'file') {
        const filename = /\bfilename="([^"]*)"/iu.exec(disposition[0])?.[1] || 'recording.webm'
        const mime = /content-type:\s*([^\r\n]+)/iu.exec(headers)?.[1]?.trim() || 'application/octet-stream'
        if (!/^audio\//iu.test(mime) && mime !== 'application/octet-stream') throw new ServiceError('INVALID_AUDIO', 400)
        const content = part.subarray(headerEnd + 4, part.length - 2)
        if (!content.length) throw new ServiceError('EMPTY_AUDIO', 400)
        return { filename: filename.replace(/[\\/\r\n"]/gu, '_').slice(0, 120), mime, content }
      }
    }
    cursor = next
  }
  throw new ServiceError('INVALID_AUDIO', 400)
}

function multipartBody(file, model) {
  const boundary = `----hosa-${randomUUID()}`
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\n` +
    `Content-Type: ${file.mime}\r\n\r\n`,
    'utf8',
  )
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
  return { body: Buffer.concat([prefix, file.content, suffix]), contentType: `multipart/form-data; boundary=${boundary}` }
}

async function limitedJson(response) {
  if (!response.ok) {
    await response.body?.cancel()
    throw new ServiceError('ASR_UNAVAILABLE')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new ServiceError('ASR_INVALID_RESPONSE')
  let size = 0
  const chunks = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_JSON_BYTES) {
      await reader.cancel()
      throw new ServiceError('ASR_INVALID_RESPONSE')
    }
    chunks.push(value)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new ServiceError('ASR_INVALID_RESPONSE') }
}

export async function transcribeAudio(audio, config, signal, fetchImpl = fetch) {
  if (!config.asr) throw new ServiceError('ASR_NOT_CONFIGURED', 503)
  const outbound = multipartBody(audio.file, config.asr.model)
  const headers = {
    'Content-Type': outbound.contentType,
    ...(config.asr.token ? { Authorization: `Bearer ${config.asr.token}` } : {}),
  }
  try {
    const response = await fetchImpl(`${config.asr.baseUrl}/audio/transcriptions`, {
      method: 'POST', headers, body: outbound.body,
      signal: AbortSignal.any([signal, AbortSignal.timeout(config.asrTimeoutMs)]),
    })
    const data = await limitedJson(response)
    if (!data || typeof data !== 'object' || typeof data.text !== 'string'
      || !data.text.trim() || data.text.length > 240) throw new ServiceError('ASR_INVALID_RESPONSE')
    return { text: data.text.trim(), provider: config.asr.label }
  } catch (error) {
    if (error instanceof ServiceError) throw error
    if (signal.aborted) throw new ServiceError('CANCELLED', 499)
    if (error instanceof Error && error.name === 'TimeoutError') throw new ServiceError('ASR_TIMEOUT', 504)
    throw new ServiceError('ASR_UNAVAILABLE')
  }
}
