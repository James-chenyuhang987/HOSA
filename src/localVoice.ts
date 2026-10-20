import { requestTranscription } from './translationClient'
import type { BackendConnection } from './translationTypes'
import type { VoiceSession, VoiceStatus } from './speech'

type Options = {
  connection: BackendConnection
  onStatus: (status: VoiceStatus, message: string) => void
  onComplete: (text: string) => void
}
const MAX_BYTES = 10 * 1024 * 1024

/** Owns every resource for a single temporary recording, including late permission grants. */
export function createLocalVoiceSession(options: Options): VoiceSession {
  let started = false
  let finished = false
  let stopping = false
  let stream: MediaStream | null = null
  let recorder: MediaRecorder | null = null
  let controller: AbortController | null = null
  let chunks: Blob[] = []
  let bytes = 0
  let startTimer: number | undefined
  let stopTimer: number | undefined

  const releaseMicrophone = () => {
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
  }
  const dispose = () => {
    window.clearTimeout(startTimer)
    window.clearTimeout(stopTimer)
    controller?.abort()
    if (recorder) {
      recorder.ondataavailable = recorder.onstop = recorder.onerror = null
      try { if (recorder.state !== 'inactive') recorder.stop() } catch { /* Already stopped. */ }
    }
    recorder = null
    releaseMicrophone()
    chunks = []
  }
  const fail = (message: string, status: VoiceStatus = 'error') => {
    if (finished) return
    finished = true
    dispose()
    options.onStatus(status, message)
  }
  const transcribe = async (blob: Blob) => {
    if (!blob.size) { fail('没有录到有效声音，请靠近麦克风后重试。'); return }
    if (blob.size > MAX_BYTES) { fail('录音已达到大小上限，请缩短录音后重试。'); return }
    controller = new AbortController()
    options.onStatus('transcribing', '麦克风已关闭，正在发送录音并识别文字…')
    try {
      const result = await requestTranscription(blob, options.connection, controller.signal)
      if (finished) return
      finished = true
      dispose()
      options.onComplete(result.text)
      options.onStatus('complete', '已识别文字，可以编辑；翻译结果见下方。')
    } catch (error) {
      fail(error instanceof Error && error.name !== 'TimeoutError'
        ? error.message : '语音识别等待超时，请缩短录音后重试。')
    }
  }
  const stop = () => {
    if (finished || stopping) return
    if (!recorder) {
      finished = true
      dispose()
      options.onStatus('idle', '已取消麦克风启动。')
      return
    }
    stopping = true
    options.onStatus('stopping', '正在关闭麦克风并整理录音…')
    stopTimer = window.setTimeout(() => fail('录音设备未能正常结束，麦克风已关闭，请重试。'), 5000)
    try {
      if (recorder.state !== 'inactive') recorder.stop()
      releaseMicrophone()
    } catch { fail('录音设备未能正常结束，麦克风已关闭，请重试。') }
  }

  return {
    start() {
      if (started || finished) return
      started = true
      options.onStatus('starting', '正在打开麦克风，请允许浏览器使用麦克风…')
      startTimer = window.setTimeout(() => fail('麦克风启动超时，请检查权限后重试。'), 12_000)
      void (async () => {
        try {
          const incoming = await navigator.mediaDevices.getUserMedia({ audio: true })
          if (finished) { incoming.getTracks().forEach((track) => track.stop()); return }
          stream = incoming
          const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) =>
            MediaRecorder.isTypeSupported?.(type)) || ''
          const current = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
          recorder = current
          current.ondataavailable = (event) => {
            if (finished || !event.data.size) return
            chunks.push(event.data)
            bytes += event.data.size
            if (bytes >= MAX_BYTES) stop()
          }
          current.onerror = () => fail('录音设备发生错误，请检查麦克风后重试。')
          current.onstop = () => {
            if (finished) return
            window.clearTimeout(stopTimer)
            releaseMicrophone()
            recorder = null
            current.ondataavailable = current.onstop = current.onerror = null
            const blob = new Blob(chunks, { type: current.mimeType || mimeType || 'audio/webm' })
            chunks = []
            void transcribe(blob)
          }
          current.start(250)
          window.clearTimeout(startTimer)
          options.onStatus('listening', '麦克风已打开，说完后点击结束录音。')
        } catch (error) {
          const denied = error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name)
          fail(denied ? '麦克风权限未开启，请允许当前页面使用麦克风后重试。'
            : '无法打开麦克风，请检查系统输入设备后重试。', denied ? 'permission-denied' : 'error')
        }
      })()
    },
    requestStop: stop,
    forceStop: stop,
    cancel() {
      if (finished) return
      finished = true
      dispose()
    },
  }
}
