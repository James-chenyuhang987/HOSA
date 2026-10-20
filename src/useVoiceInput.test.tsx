import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useVoiceInput } from './useVoiceInput'

class Recognition {
  static last: Recognition
  static starts = true
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null
  stop = vi.fn()
  abort = vi.fn()
  constructor() { Recognition.last = this }
  start() { if (Recognition.starts) this.onstart?.() }
}
const options = () => ({
  language: 'zh-CN', sourceLabel: '普通话', hint: '', asrEnabled: false, asrConfigured: false,
  connection: { url: '/api', token: '' }, onStart: vi.fn(), onDraft: vi.fn(), onComplete: vi.fn(),
})
beforeEach(() => {
  vi.useFakeTimers()
  Recognition.starts = true
  window.SpeechRecognition = Recognition as unknown as SpeechRecognitionConstructor
})
afterEach(() => { cleanup(); delete window.SpeechRecognition; vi.useRealTimers(); vi.unstubAllGlobals() })

it('stops the actual browser session after falling back from local mode', () => {
  vi.stubGlobal('MediaRecorder', undefined)
  const config = { ...options(), asrEnabled: true, asrConfigured: true }
  const { result } = renderHook(() => useVoiceInput(config))
  act(() => result.current.start())
  expect(result.current.status).toBe('listening')
  expect(result.current.message).toContain('已改用浏览器语音识别')
  act(() => result.current.toggle())
  expect(Recognition.last.stop).toHaveBeenCalledTimes(1)
  expect(result.current.status).toBe('stopping')
  act(() => result.current.toggle())
  expect(Recognition.last.abort).toHaveBeenCalledTimes(1)
  expect(result.current.status).toBe('idle')
})

it('stops browser capture after sixty seconds and recovers if it never ends', async () => {
  const { result } = renderHook(() => useVoiceInput(options()))
  act(() => result.current.start())
  await act(() => vi.advanceTimersByTimeAsync(60_000))
  expect(Recognition.last.stop).toHaveBeenCalledTimes(1)
  expect(result.current.seconds).toBe(60)
  expect(result.current.status).toBe('stopping')
  await act(() => vi.advanceTimersByTimeAsync(5000))
  expect(Recognition.last.abort).toHaveBeenCalled()
  expect(result.current.active).toBe(false)
})

it('cancels a pending browser startup and ignores a late start callback', () => {
  Recognition.starts = false
  const { result } = renderHook(() => useVoiceInput(options()))
  act(() => result.current.start())
  expect(result.current.label).toBe('取消启动')
  act(() => result.current.toggle())
  expect(Recognition.last.abort).toHaveBeenCalled()
  act(() => Recognition.last.onstart?.())
  expect(result.current.status).toBe('idle')
})

it('ignores late transcripts after editing cancels a session', () => {
  const config = options()
  const { result } = renderHook(() => useVoiceInput(config))
  act(() => result.current.start())
  act(() => result.current.cancel())
  act(() => Recognition.last.onresult?.({ results: { length: 1, 0: { isFinal: true, 0: { transcript: '旧内容' } } } } as unknown as SpeechRecognitionEvent))
  expect(config.onDraft).not.toHaveBeenCalled()
  expect(config.onComplete).not.toHaveBeenCalled()
})

it('requires text review instead of automatically translating a truncated long recording', () => {
  const config = options()
  const { result } = renderHook(() => useVoiceInput(config))
  act(() => result.current.start())
  act(() => Recognition.last.onresult?.({ results: { length: 1, 0: { isFinal: true, 0: { transcript: '字'.repeat(241) } } } } as unknown as SpeechRecognitionEvent))
  expect(Recognition.last.stop).toHaveBeenCalled()
  act(() => Recognition.last.onend?.())
  expect(config.onComplete).not.toHaveBeenCalled()
  expect(result.current.requiresTextReview).toBe(true)
  expect(result.current.status).toBe('error')
  expect(result.current.message).toContain('本次未自动翻译')
  act(() => result.current.cancel())
  expect(result.current.requiresTextReview).toBe(false)
})
