import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPrompt, callModel, protectDetails, translate, validateInput, validateOutput } from './translator.mjs'
import { validateModelConfig } from './config.mjs'

const input = { text: '我昨天晚上开始头晕，今天又吐了。', dialect: 'cantonese', direction: 'toDialect' }
const model = { id: 'hy', label: '混元测试', enabled: true, runtime: 'ollama', profile: 'hy-mt', baseUrl: 'http://127.0.0.1:11434', model: 'test-hy' }
function configuration(models = [model]) {
  return { ...validateModelConfig({ models, routes: { cantonese: models.map((entry) => entry.id), minnan: [], shanghai: [], sichuan: [], northeast: [] } }), requestTimeoutMs: 1000, providerTimeoutMs: 100 }
}
const response = (text) => Response.json({ done: true, done_reason: 'stop', message: { content: text } })

test('rejects unsupported dialects, oversized input and client-controlled model URLs', () => {
  assert.throws(() => validateInput({ ...input, dialect: 'unknown' }))
  assert.throws(() => validateInput({ ...input, text: '字'.repeat(241) }))
  assert.throws(() => validateInput({ ...input, baseUrl: 'http://attacker.test' }))
  assert.deepEqual(validateInput({ ...input, text: ` ${input.text} ` }), input)
})

test('does not route specialist models to unsupported dialects', () => {
  assert.throws(() => validateModelConfig({ models: [model], routes: { cantonese: ['hy'], minnan: [], shanghai: ['hy'], sichuan: [], northeast: [] } }))
})

test('uses official MiLMMT completion language names in both directions', () => {
  const profile = { ...model, profile: 'milmmt' }
  assert.match(buildPrompt(profile, input).prompt, /^Translate this from Chinese \(Simplified\) to Cantonese:/u)
  assert.match(buildPrompt(profile, { ...input, direction: 'toMandarin' }).prompt, /^Translate this from Cantonese to Chinese \(Simplified\):/u)
})

test('uses the Taigi translation template and converts input script without changing the task', () => {
  const prompt = buildPrompt({ ...model, profile: 'taigi' }, { text: '请问医院在哪里', dialect: 'minnan', direction: 'toDialect' })
  assert.equal(prompt.kind, 'completion')
  assert.equal(prompt.prompt, '[TRANS]\n請問醫院在哪裡\n[/TRANS]\n[HAN]\n')
  assert.deepEqual(prompt.stop, ['[/'])
  assert.match(buildPrompt({ ...model, profile: 'taigi' }, { ...input, dialect: 'minnan', direction: 'toMandarin' }).prompt, /\[ZH\]\n$/u)
})

test('protects and restores drug names, doses and Chinese quantities verbatim', () => {
  const request = { ...input, text: '我每天吃阿莫西林250 mg，已经吃了三天。' }
  const protectedInput = protectDetails(request.text)
  assert.equal(protectedInput.values.length, 2)
  const translated = protectedInput.text.replace('每天吃', '每日食').replace('已经吃了', '已经食咗')
  assert.equal(validateOutput(translated, request, protectedInput), '我每日食阿莫西林250 mg，已经食咗三天。')
  assert.throws(() => validateOutput(translated.replace(protectedInput.values[0].key, '500 mg'), request, protectedInput))
  assert.throws(() => validateOutput(`${translated}一次。`, request, protectedInput))
  assert.throws(() => validateOutput(`${translated}${protectedInput.values[0].key}`, request, protectedInput))
})

test('also protects traditional drug names during reverse translation', () => {
  const request = { ...input, text: '我食咗250 mg華法林。', direction: 'toMandarin' }
  const protectedInput = protectDetails(request.text)
  assert.equal(protectedInput.values.length, 1)
  assert.equal(validateOutput(protectedInput.text.replace('食咗', '吃了'), request, protectedInput), '我吃了250 mg華法林。')
})

test('rejects lost uncertainty and negation, unfinished thoughts and empty responses', () => {
  const uncertain = { ...input, text: '我可能怀孕了，今天没有吃药。' }
  const protectedInput = protectDetails(uncertain.text)
  assert.throws(() => validateOutput('我怀孕喇，今日冇食药。', uncertain, protectedInput))
  assert.throws(() => validateOutput('我可能怀孕喇，今日食咗药。', uncertain, protectedInput))
  assert.throws(() => validateOutput('<think>还在思考', input, protectDetails(input.text)))
  assert.throws(() => validateOutput('', input, protectDetails(input.text)))
  assert.equal(validateOutput('<think>分析</think>我可能怀孕喇，今日冇食药。', uncertain, protectedInput), '我可能怀孕喇，今日冇食药。')
})

test('falls back from an unavailable model and labels the actual responding model', async () => {
  const second = { ...model, id: 'backup', label: '备用测试', model: 'test-backup' }
  const calls = []
  const result = await translate(input, configuration([model, second]), new AbortController().signal, async (_url, options) => {
    const body = JSON.parse(options.body)
    calls.push(body.model)
    if (body.model === model.model) return new Response('', { status: 503 })
    return response('我由琴晚开始头晕，今日又呕咗。')
  })
  assert.deepEqual(calls, ['test-hy', 'test-backup'])
  assert.equal(result.provider, '备用测试')
  assert.equal(result.needsReview, true)
})

test('falls back from a model output that drops a protected dose', async () => {
  const request = { ...input, text: '我吃了250mg阿莫西林。' }
  const values = protectDetails(request.text)
  let calls = 0
  const result = await translate(request, configuration([model, { ...model, id: 'backup' }]), new AbortController().signal, async () => {
    calls += 1
    return response(calls === 1 ? '我食咗500mg阿莫西林。' : values.text.replace('吃了', '食咗'))
  })
  assert.equal(calls, 2)
  assert.equal(result.text, '我食咗250mg阿莫西林。')
})

test('passes raw completion prompts to Ollama and rejects truncated answers', async () => {
  let recorded
  await callModel({ ...model, profile: 'milmmt' }, buildPrompt({ ...model, profile: 'milmmt' }, input), new AbortController().signal,
    async (url, options) => { recorded = { url, body: JSON.parse(options.body) }; return Response.json({ response: '译文', done_reason: 'stop' }) })
  assert.equal(recorded.url, 'http://127.0.0.1:11434/api/generate')
  assert.equal(recorded.body.raw, true)
  assert.equal(recorded.body.stream, false)
  await assert.rejects(callModel(model, buildPrompt(model, input), new AbortController().signal,
    async () => Response.json({ done_reason: 'length', message: { content: '半句' } })))
})

test('uses OpenAI-compatible completions for MiLMMT and chat for Hy-MT', async () => {
  const requests = []
  const fetchImpl = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) })
    return Response.json({ choices: [{ finish_reason: 'stop', text: '完成', message: { content: '完成' } }] })
  }
  const openai = { ...model, runtime: 'openai', baseUrl: 'http://127.0.0.1:8000/v1' }
  await callModel(openai, buildPrompt(openai, input), new AbortController().signal, fetchImpl)
  await callModel({ ...openai, profile: 'milmmt' }, buildPrompt({ ...openai, profile: 'milmmt' }, input), new AbortController().signal, fetchImpl)
  assert.match(requests[0].url, /\/v1\/chat\/completions$/u)
  assert.ok(requests[0].body.messages)
  assert.match(requests[1].url, /\/v1\/completions$/u)
  assert.ok(requests[1].body.prompt)
})

test('never continues the fallback chain after cancellation', async () => {
  const controller = new AbortController()
  let calls = 0
  await assert.rejects(translate(input, configuration([model, { ...model, id: 'backup' }]), controller.signal, async (_url, options) => {
    calls += 1
    controller.abort()
    throw options.signal.reason
  }), (error) => error.code === 'CANCELLED')
  assert.equal(calls, 1)
})

function stalledModel(signal) {
  return new Promise((_resolve, reject) => {
    const keepAlive = setTimeout(() => reject(new Error('test deadline exceeded')), 1000)
    signal.addEventListener('abort', () => { clearTimeout(keepAlive); reject(signal.reason) }, { once: true })
  })
}

test('tries a backup after a provider timeout', async () => {
  let calls = 0
  const config = { ...configuration([model, { ...model, id: 'backup' }]), providerTimeoutMs: 25 }
  const result = await translate(input, config, new AbortController().signal, async (_url, options) => {
    calls += 1
    if (calls === 1) return stalledModel(options.signal)
    return response('我由琴晚开始头晕，今日又呕咗。')
  })
  assert.equal(calls, 2)
  assert.equal(result.providerId, 'backup')
})

test('stops the whole fallback chain at the request deadline', async () => {
  let calls = 0
  const config = { ...configuration([model, { ...model, id: 'backup' }]), requestTimeoutMs: 25, providerTimeoutMs: 500 }
  await assert.rejects(translate(input, config, new AbortController().signal, async (_url, options) => {
    calls += 1
    return stalledModel(options.signal)
  }), (error) => error.code === 'TIMEOUT' && error.status === 504)
  assert.equal(calls, 1)
})

test('reports no configured model instead of using a specialist for another dialect', async () => {
  await assert.rejects(translate({ ...input, dialect: 'sichuan' }, configuration(), new AbortController().signal), (error) => error.code === 'NO_PROVIDER')
})

test('rejects negation moved from one symptom to another, even if the whole output still contains negation', () => {
  const request = { ...input, text: '我没有发烧，但是有咳嗽。' }
  const protectedInput = protectDetails(request.text)
  assert.throws(() => validateOutput('我有发烧，但係冇咳。', request, protectedInput))
  assert.throws(() => validateOutput('我冇发烧。', request, protectedInput))
  assert.equal(validateOutput('我冇发烧，但係有咳。', request, protectedInput), '我冇发烧，但係有咳。')
})

test('preserves positive and negative symptom lists without treating a later negation as applying backwards', () => {
  for (const [source, output] of [
    ['我发烧也没有咳嗽。', '我发烧，冇咳。'],
    ['我没有发烧和咳嗽。', '我冇发烧同咳。'],
    ['我没有发烧，但是呕吐了。', '我冇发烧，但係呕咗。'],
  ]) {
    const request = { ...input, text: source }
    assert.equal(validateOutput(output, request, protectDetails(source)), output)
  }
})

test('rejects lost or swapped laterality and time anchors', () => {
  for (const [source, output] of [
    ['我左边肚子痛。', '我右边肚痛。'], ['我右边肚子痛。', '我肚痛。'],
    ['我从昨天晚上开始头晕。', '我由今朝开始头晕。'], ['我从昨天晚上开始头晕。', '我头晕。'],
  ]) {
    const request = { ...input, text: source }
    assert.throws(() => validateOutput(output, request, protectDetails(source)))
  }
  const request = { ...input, text: '我从昨天晚上开始左边肚子痛。' }
  assert.equal(validateOutput('我由琴晚开始左边肚痛。', request, protectDetails(request.text)), '我由琴晚开始左边肚痛。')
})

test('handles Shanghai 今朝 as today while keeping Cantonese 今朝 as this morning', () => {
  const request = { ...input, text: '我今天没有吃药。', dialect: 'shanghai' }
  assert.equal(validateOutput('我今朝呒没吃药。', request, protectDetails(request.text)), '我今朝呒没吃药。')
  assert.throws(() => validateOutput('我今朝冇食药。', { ...request, dialect: 'cantonese' }, protectDetails(request.text)))
})

test('keeps questions as questions rather than giving the patient an answer', () => {
  const request = { ...input, text: '我需要停药吗？' }
  assert.throws(() => validateOutput('你需要停药。', request, protectDetails(request.text)))
  assert.equal(validateOutput('我要唔要停药？', request, protectDetails(request.text)), '我要唔要停药？')
})

test('binds each medication to its own stated dose and preserves blood pressure, dates and times', () => {
  const request = { ...input, text: '我吃阿莫西林250 mg和布洛芬200mg，血压125/80mmHg，预约2026-10-20 08:30。' }
  const protectedInput = protectDetails(request.text)
  assert.deepEqual(protectedInput.values.map((entry) => entry.value), ['阿莫西林250 mg', '布洛芬200mg', '125/80mmHg', '2026-10-20', '08:30'])
  assert.equal(validateOutput(protectedInput.text.replace('吃', '食'), request, protectedInput), request.text.replace('吃', '食'))
  assert.throws(() => validateOutput('我食阿莫西林200mg和布洛芬250 mg，血压125/80mmHg，预约2026-10-20 08:30。', request, protectedInput))
})

test('rejects a newly invented known medication even when no extra dose was added', () => {
  const request = { ...input, text: '我对这个药过敏。' }
  assert.throws(() => validateOutput('我对青霉素过敏。', request, protectDetails(request.text)))
  const named = { ...input, text: '我吃阿莫西林。' }
  const protectedInput = protectDetails(named.text)
  assert.throws(() => validateOutput(`${protectedInput.text}同布洛芬。`, named, protectedInput))
})

test('preserves formal anatomical regions rather than relying on a loose colloquial location match', () => {
  const request = { ...input, text: '我从昨天晚上开始右下腹疼痛，没有发烧，但一直想吐。' }
  const protectedInput = protectDetails(request.text)
  assert.deepEqual(protectedInput.values.map((entry) => entry.value), ['右下腹'])
  const correct = `我由昨晚开始${protectedInput.values[0].key}痛，冇发烧，但一直想呕。`
  assert.equal(validateOutput(correct, request, protectedInput), '我由昨晚开始右下腹痛，冇发烧，但一直想呕。')
  assert.throws(() => validateOutput('由昨晚开始右下方肚痛，冇发烧，但一直想呕。', request, protectedInput))
})

test('distinguishes unverified content from an unavailable model after exhausting fallbacks', async () => {
  const request = { ...input, text: '我没有发烧，但有咳嗽。' }
  await assert.rejects(translate(request, configuration(), new AbortController().signal,
    async () => response('我发烧，但冇咳。')), (error) => error.code === 'TRANSLATION_UNVERIFIED')
})

test('uses dialect-specific writing guidance and relevant examples without inventing clinical advice', () => {
  const prompt = buildPrompt({ ...model, profile: 'general' }, { ...input, dialect: 'sichuan' })
  assert.match(prompt.messages[0].content, /不要在每句末尾机械添加/u)
  assert.match(prompt.messages[0].content, /问句仍是问句/u)
  assert.match(prompt.messages[0].content, /“不舒服”不能擅自变成/u)
  assert.match(prompt.messages[0].content, /我头晕/u)
})
