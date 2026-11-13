import { afterEach, expect, it, vi } from 'vitest'
import { checkBackend, requestModelTranslation, validateBackendConnection } from './translationClient'
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
it('uses a lightweight health check by default and a longer deadline for inference probes', async () => {
  const timeout = vi.spyOn(AbortSignal, 'timeout')
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ service: 'hosa-translation', models: [] })))
  vi.stubGlobal('fetch', fetchMock)
  const connection = { url: '/api', token: '' }
  await checkBackend(connection, new AbortController().signal)
  await checkBackend(connection, new AbortController().signal, true)
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/health', '/api/health?probe=1'])
  expect(timeout.mock.calls).toEqual([[10_000], [40_000]])
})

it('explains an overlong transcript instead of silently dropping its final words', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ text: '字'.repeat(241) })))
  const { requestTranscription } = await import('./translationClient')
  await expect(requestTranscription(new Blob(['audio']), { url: '/api', token: '' }, new AbortController().signal))
    .rejects.toThrow('识别文字超过 240 字，请分成短句重新录音。')
})

it('explains a rejected model translation as a content check rather than a service outage', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'TRANSLATION_UNVERIFIED' }, { status: 503 })))
  await expect(requestModelTranslation({ text: '我没有发烧，但是有咳嗽。', dialect: 'cantonese', direction: 'toDialect' },
    { url: '/api', token: '' }, new AbortController().signal)).rejects.toThrow('模型译文未通过完整性检查，已保留词库参考；请分成短句后重试。')
})

it('blocks unsafe remote endpoints before a bearer token can leave the page', async () => {
  expect(validateBackendConnection({ url: 'http://example.test/api', token: 'a'.repeat(32) }))
    .toMatch(/远程后端必须使用 HTTPS/u)
  expect(validateBackendConnection({ url: 'https://example.test/api', token: 'sk-deepseek-key' }))
    .toMatch(/DeepSeek API Key/u)
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  await expect(checkBackend({ url: 'https://example.test/api?redirect=1', token: 'a'.repeat(32) }, new AbortController().signal))
    .rejects.toThrow(/查询参数/u)
  expect(fetchMock).not.toHaveBeenCalled()
})
