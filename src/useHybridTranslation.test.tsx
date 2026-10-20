import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useHybridTranslation } from './useHybridTranslation'
import type { Translation } from './translationTypes'

const local = vi.fn((text: string): Translation => ({ text: `${text}（参考）`, pronunciation: '', note: '', confidence: 'wording' }))
const response = (text = '模型译文') => Response.json({ text, provider: '测试模型', needsReview: true })
beforeEach(() => { local.mockClear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

it('deduplicates active requests and reuses only successful results', async () => {
  let resolve!: (value: Response) => void
  const fetchMock = vi.fn(() => new Promise<Response>((done) => { resolve = done }))
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useHybridTranslation(local))
  act(() => result.current.updateMode(true))
  let request!: Promise<void>
  act(() => { request = result.current.run('原文', 'cantonese', 'toDialect') })
  await act(() => result.current.run('原文', 'cantonese', 'toDialect'))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await act(async () => { resolve(response()); await request })
  await act(() => result.current.run('原文', 'cantonese', 'toDialect'))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(result.current.translation?.text).toBe('模型译文')
  expect(result.current.snapshot).toEqual({ text: '原文', dialect: 'cantonese', direction: 'toDialect' })
})

it('does not cache failures, and clears its cache when the connection changes', async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockImplementation(() => Promise.resolve(response()))
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useHybridTranslation(local))
  act(() => result.current.updateMode(true))
  await act(() => result.current.run('原文', 'cantonese', 'toDialect'))
  expect(result.current.canRetry).toBe(true)
  await act(() => result.current.run('原文', 'cantonese', 'toDialect'))
  expect(result.current.canRetry).toBe(false)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  act(() => result.current.updateConnection({ url: '/api2', token: '' }))
  expect(result.current.translation?.text).toBe('模型译文')
  expect(result.current.snapshot).toBeNull()
  await act(() => result.current.run('原文', 'cantonese', 'toDialect'))
  expect(fetchMock).toHaveBeenCalledTimes(3)
})

it('bounds the cache to 20 results and expires entries after five minutes', async () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useHybridTranslation(local))
  for (let index = 0; index <= 20; index++) await act(() => result.current.run(`句子${index}`, 'cantonese', 'toDialect'))
  local.mockClear()
  await act(() => result.current.run('句子1', 'cantonese', 'toDialect'))
  expect(local).not.toHaveBeenCalled()
  await act(() => result.current.run('句子0', 'cantonese', 'toDialect'))
  expect(local).toHaveBeenCalledTimes(1)
  await act(async () => { vi.advanceTimersByTime(5 * 60_000) })
  await act(() => result.current.run('句子1', 'cantonese', 'toDialect'))
  expect(local).toHaveBeenCalledTimes(2)
})

it('does not reuse translations across dialects, directions, or model mode', async () => {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response()))
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useHybridTranslation(local))
  await act(() => result.current.run('原文', 'cantonese', 'toDialect'))
  await act(() => result.current.run('原文', 'sichuan', 'toDialect'))
  await act(() => result.current.run('原文', 'sichuan', 'toMandarin'))
  act(() => result.current.updateMode(true))
  await act(() => result.current.run('原文', 'sichuan', 'toMandarin'))
  expect(local).toHaveBeenCalledTimes(4)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('clears both model and ASR health after a failed check', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(Response.json({ service: 'hosa-translation', models: [], asr: { configured: true } }))
    .mockRejectedValueOnce(new TypeError('offline')))
  const { result } = renderHook(() => useHybridTranslation(local))
  await act(() => result.current.check())
  expect(result.current.asr.configured).toBe(true)
  await act(() => result.current.check())
  expect(result.current.asr.configured).toBe(false)
  expect(result.current.models).toEqual([])
})
