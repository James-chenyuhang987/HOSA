import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createLocalVoiceSession } from './localVoice'
const { transcribe } = vi.hoisted(() => ({ transcribe: vi.fn() }))
vi.mock('./translationClient', () => ({ requestTranscription: transcribe }))

class Recorder {
  static last: Recorder
  static emitsStop = true
  static isTypeSupported() { return true }
  state: RecordingState = 'inactive'
  mimeType = 'audio/webm'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() { Recorder.last = this }
  start() { this.state = 'recording' }
  stop() {
    this.state = 'inactive'
    if (Recorder.emitsStop) {
      this.ondataavailable?.({ data: new Blob(['recording']) })
      this.onstop?.()
    }
  }
}
let stopTrack: ReturnType<typeof vi.fn>
let permission: ReturnType<typeof vi.fn>
const flush = async () => { await Promise.resolve(); await Promise.resolve() }
function session() {
  const onStatus = vi.fn(), onComplete = vi.fn()
  const voice = createLocalVoiceSession({ connection: { url: '/api', token: '' }, onStatus, onComplete })
  voice.start()
  return { voice, onStatus, onComplete }
}
beforeEach(() => {
  vi.useFakeTimers()
  Recorder.emitsStop = true
  stopTrack = vi.fn()
  permission = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] })
  vi.stubGlobal('MediaRecorder', Recorder)
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: permission } })
  transcribe.mockReset().mockResolvedValue({ text: '你好' })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); delete (navigator as { mediaDevices?: unknown }).mediaDevices })

it('closes the microphone before awaiting ASR, and delivers the final text', async () => {
  let resolve!: (value: { text: string }) => void
  transcribe.mockImplementation(() => new Promise((done) => { resolve = done }))
  const { voice, onStatus, onComplete } = session()
  await flush()
  voice.requestStop()
  expect(stopTrack).toHaveBeenCalled()
  expect(onStatus).toHaveBeenLastCalledWith('transcribing', expect.any(String))
  expect(onComplete).not.toHaveBeenCalled()
  resolve({ text: '你好' })
  await flush()
  expect(onComplete).toHaveBeenCalledWith('你好')
  expect(onStatus).toHaveBeenLastCalledWith('complete', expect.any(String))
})

it('releases a late permission grant after cancellation without starting or uploading audio', async () => {
  let grant!: (value: unknown) => void
  permission.mockImplementation(() => new Promise((resolve) => { grant = resolve }))
  const { voice, onStatus } = session()
  voice.cancel()
  grant({ getTracks: () => [{ stop: stopTrack }] })
  await flush()
  expect(stopTrack).toHaveBeenCalledTimes(1)
  expect(onStatus).toHaveBeenCalledTimes(1)
  expect(transcribe).not.toHaveBeenCalled()
})

it('recovers from startup timeout and releases permission granted afterwards', async () => {
  let grant!: (value: unknown) => void
  permission.mockImplementation(() => new Promise((resolve) => { grant = resolve }))
  const { onStatus } = session()
  await vi.advanceTimersByTimeAsync(12_000)
  expect(onStatus).toHaveBeenLastCalledWith('error', expect.stringContaining('启动超时'))
  grant({ getTracks: () => [{ stop: stopTrack }] })
  await flush()
  expect(stopTrack).toHaveBeenCalled()
  expect(transcribe).not.toHaveBeenCalled()
})

it('recovers if the recorder never emits stop', async () => {
  Recorder.emitsStop = false
  const { voice, onStatus } = session()
  await flush()
  voice.requestStop()
  expect(stopTrack).toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(5000)
  expect(onStatus).toHaveBeenLastCalledWith('error', expect.stringContaining('未能正常结束'))
  expect(transcribe).not.toHaveBeenCalled()
})

it('ignores a late ASR response after cancellation', async () => {
  let resolve!: (value: { text: string }) => void
  transcribe.mockImplementation(() => new Promise((done) => { resolve = done }))
  const { voice, onComplete } = session()
  await flush()
  voice.requestStop()
  const signal = transcribe.mock.calls[0][2] as AbortSignal
  voice.cancel()
  expect(signal.aborted).toBe(true)
  resolve({ text: '迟到结果' })
  await flush()
  expect(onComplete).not.toHaveBeenCalled()
})

it('handles an unexpected device stop without remaining in listening state', async () => {
  const { onStatus, onComplete } = session()
  await flush()
  Recorder.last.ondataavailable?.({ data: new Blob(['audio']) })
  Recorder.last.state = 'inactive'
  Recorder.last.onstop?.()
  await flush()
  expect(stopTrack).toHaveBeenCalled()
  expect(onComplete).toHaveBeenCalledWith('你好')
  expect(onStatus).toHaveBeenLastCalledWith('complete', expect.any(String))
})

it('cleans up device errors and ignores previously queued stop events', async () => {
  const { onStatus } = session()
  await flush()
  const stop = Recorder.last.onstop
  Recorder.last.onerror?.()
  stop?.()
  expect(stopTrack).toHaveBeenCalled()
  expect(onStatus).toHaveBeenLastCalledWith('error', expect.stringContaining('录音设备发生错误'))
  expect(transcribe).not.toHaveBeenCalled()
})

it('rejects empty audio and stops oversized recordings before upload', async () => {
  const first = session()
  await flush()
  Recorder.last.state = 'inactive'
  Recorder.last.onstop?.()
  expect(first.onStatus).toHaveBeenLastCalledWith('error', expect.stringContaining('没有录到有效声音'))
  const second = session()
  await flush()
  Recorder.last.ondataavailable?.({ data: new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]) })
  expect(second.onStatus).toHaveBeenLastCalledWith('error', expect.stringContaining('大小上限'))
  expect(stopTrack).toHaveBeenCalled()
  expect(transcribe).not.toHaveBeenCalled()
})
