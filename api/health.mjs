import { probeModel, probeModelTranslation } from '../server/translator.mjs'
import { corsAndAuth, errorStatus, getConfig, sendJson } from './_shared.mjs'

export const maxDuration = 60

export default async function handler(req, res) {
  let config
  try { config = await getConfig() }
  catch { res.statusCode = 500; res.end(JSON.stringify({ error: 'INTERNAL_CONFIG' })); return }
  if (!corsAndAuth(req, res, config)) return
  if (req.method !== 'GET') { sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' }); return }
  const probe = new URL(req.url || '/', 'https://vercel.local').searchParams.get('probe') === '1'
  try {
    const models = await Promise.all(config.models.filter((model) => model.enabled).map(async (model) => {
      const available = await probeModel(model, fetch)
      const ready = probe && available ? await probeModelTranslation(model, fetch, new AbortController().signal, 15_000) : undefined
      return { id: model.id, label: model.label, dialects: model.dialects, available, ...(probe ? { ready } : {}) }
    }))
    sendJson(res, 200, {
      service: 'hosa-translation', models,
      asr: config.asr ? { configured: true, label: config.asr.label, model: config.asr.model } : { configured: false },
    })
  } catch (error) {
    sendJson(res, errorStatus(error), { error: error?.code || 'MODELS_UNAVAILABLE' })
  }
}
