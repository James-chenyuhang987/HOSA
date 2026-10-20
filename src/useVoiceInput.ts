import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createVoiceSession } from './speech'
import type { VoiceSession, VoiceStatus } from './speech'
import { createLocalVoiceSession } from './localVoice'
import type { BackendConnection } from './translationTypes'

type Options = {
  language: string
  sourceLabel: string
  hint: string
  asrEnabled: boolean
  asrConfigured: boolean
  connection: BackendConnection
  onStart: () => void
  onDraft: (text: string) => void
  onComplete: (text: string) => void
}
const activeStatuses: VoiceStatus[] = ['starting', 'listening', 'reconnecting', 'stopping', 'uploading', 'transcribing']

export function useVoiceInput(options: Options) {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [message, setMessage] = useState('点击麦克风说话，或直接输入文字。')
  const [seconds, setSeconds] = useState(0)
  const [requiresTextReview, setRequiresTextReview] = useState(false)
  const current = useRef<{ engine: 'browser' | 'local'; session: VoiceSession } | null>(null)
  const startedAt = useRef<number | null>(null)
  const limitTimer = useRef<number | undefined>(undefined)
  const latest = useRef(options)
  useLayoutEffect(() => { latest.current = options })

  const clearClock = useCallback(() => {
    window.clearTimeout(limitTimer.current)
    startedAt.current = null
  }, [])
  const cancel = useCallback(() => {
    const previous = current.current
    current.current = null
    previous?.session.cancel()
    clearClock()
    setRequiresTextReview(false)
    setStatus('idle')
    setMessage(previous ? '录音已取消，可以输入文字或重新录音。' : '点击麦克风说话，或直接输入文字。')
  }, [clearClock])

  useEffect(() => () => {
    const previous = current.current
    current.current = null
    previous?.session.cancel()
    clearClock()
  }, [clearClock])

  useEffect(() => {
    if (status !== 'listening' && status !== 'reconnecting') return
    const clockStart = startedAt.current ?? Date.now()
    startedAt.current = clockStart
    const tick = window.setInterval(() => setSeconds(Math.min(60, Math.floor((Date.now() - clockStart) / 1000))), 1000)
    return () => window.clearInterval(tick)
  }, [status])

  const start = (forceBrowser = false) => {
    cancel()
    const config = latest.current
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
    const localSupported = Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined'
    const useLocal = config.asrEnabled && !forceBrowser && localSupported
    if (useLocal && !config.asrConfigured) {
      setStatus('error')
      setMessage('本地语音服务尚未连接，请在翻译设置中检测连接，或改用浏览器重新录音。')
      return
    }
    if (!useLocal && !Recognition) {
      setStatus('unsupported')
      setMessage('当前浏览器不支持语音识别，请直接输入文字。')
      return
    }
    config.onStart()
    setSeconds(0)
    const onStatus = (next: VoiceStatus, text: string) => {
      if (current.current?.session !== session) return
      setStatus(next)
      setMessage(!useLocal && config.asrEnabled && !forceBrowser && next === 'listening'
        ? `已改用浏览器语音识别。${text}` : text)
      if (next === 'listening' && startedAt.current === null) {
        startedAt.current = Date.now()
        limitTimer.current = window.setTimeout(() => {
          if (current.current?.session === session) { setSeconds(60); session.requestStop() }
        }, 60_000)
      }
      if (next === 'stopping' || !activeStatuses.includes(next)) clearClock()
      if (!activeStatuses.includes(next)) current.current = null
    }
    const session = useLocal ? createLocalVoiceSession({
      connection: { ...config.connection }, onStatus,
      onComplete: (text) => { if (current.current?.session === session) config.onComplete(text) },
    }) : createVoiceSession({
      Recognition: Recognition!, language: config.language, sourceLabel: config.sourceLabel, hint: config.hint, onStatus,
      onTranscript: (text) => {
        if (current.current?.session !== session) return
        config.onDraft(text.slice(0, 240))
        if (text.length > 240) session.requestStop()
      },
      onComplete: (text) => {
        if (current.current?.session !== session) return
        if (text.length > 240) {
          current.current = null
          clearClock()
          setRequiresTextReview(true)
          setStatus('error')
          setMessage('识别文字超过 240 字，已保留前 240 字。本次未自动翻译，请核对后编辑，或分句重新录音。')
          return
        }
        config.onComplete(text)
      },
    })
    current.current = { engine: useLocal ? 'local' : 'browser', session }
    session.start()
  }

  const toggle = () => {
    if (current.current) {
      if (status === 'listening' || status === 'reconnecting') current.current.session.requestStop()
      else cancel()
    } else start()
  }
  const active = activeStatuses.includes(status)
  const capturing = ['starting', 'listening', 'reconnecting', 'stopping'].includes(status)
  const label = status === 'starting' ? '取消启动'
    : status === 'listening' || status === 'reconnecting' ? '结束录音'
      : active ? '取消识别' : '开始录音'
  return { status, message, seconds, requiresTextReview, active, capturing, label, cancel, start, toggle,
    canUseBrowser: Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition),
    canRetry: Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)
      || (options.asrEnabled && options.asrConfigured && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined') }
}
