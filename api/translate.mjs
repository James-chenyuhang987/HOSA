import { ServiceError, translate, validateInput } from '../server/translator.mjs'
import { corsAndAuth, errorStatus, getConfig, readJsonBody, sendJson } from './_shared.mjs'

export const maxDuration = 60

export default async function handler(req, res) {
  let config
  try { config = await getConfig() }
  catch { res.statusCode = 500; res.end(JSON.stringify({ error: 'INTERNAL_CONFIG' })); return }
  if (!corsAndAuth(req, res, config)) return
  if (req.method !== 'POST') { sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' }); return }
  if (!/^application\/json(?:\s*;|$)/iu.test(String(req.headers['content-type'] || ''))) {
    sendJson(res, 415, { error: 'INVALID_INPUT' }); return
  }
  try {
    const input = validateInput(await readJsonBody(req))
    const result = await translate(input, config, req.signal || new AbortController().signal, fetch)
    sendJson(res, 200, result)
  } catch (error) {
    const normalized = error?.message === 'TOO_LARGE' ? new ServiceError('INVALID_INPUT', 413) : error
    sendJson(res, errorStatus(normalized), { error: normalized?.code || 'INVALID_INPUT' })
  }
}
