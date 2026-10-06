export type VoiceStatus =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'reconnecting'
  | 'stopping'
  | 'complete'
  | 'unsupported'
  | 'permission-denied'
  | 'error'

export type VoiceSession = {
  start: () => void
  requestStop: () => void
  forceStop: () => void
  cancel: () => void
}

type VoiceOptions = {
  Recognition: SpeechRecognitionConstructor
  language: string
  sourceLabel: string
  hint?: string
  onStatus: (status: VoiceStatus, message: string) => void
  onTranscript: (text: string) => void
  onComplete: (text: string) => void
}

type Attempt = {
  recognition: SpeechRecognition
  text: string
  final: boolean
  ended: boolean
}

const STOP_TIMEOUT_MS = 5000
const START_TIMEOUT_MS = 12000
const RESTART_DELAY_MS = 260
const END_GRACE_MS = 360
const MAX_EMPTY_RESTARTS = 3

function abortSafely(recognition: SpeechRecognition) {
  try {
    recognition.abort()
  } catch {
    // Some browsers throw after the recognition service has already ended.
  }
}

/** One user recording, potentially spanning several browser recognition attempts. */
export function createVoiceSession(options: VoiceOptions): VoiceSession {
  let attempt: Attempt | null = null
  let committedText = ''
  let interimBackup = ''
  let finished = false
  let started = false
  let stopRequested = false
  let emptyRestarts = 0
  let audioStarted = false
  let soundDetected = false
  let speechDetected = false
  let noMatch = false
  let retainedInterim = false
  let startTimer: number | undefined
  let stopTimer: number | undefined
  let restartTimer: number | undefined
  let endTimer: number | undefined

  const current = (candidate: Attempt) => !finished && attempt === candidate
  const textSoFar = () => {
    const currentText = `${committedText}${attempt?.text ?? ''}`.trim()
    return currentText || interimBackup
  }
  const clearTimers = () => {
    window.clearTimeout(startTimer)
    window.clearTimeout(stopTimer)
    window.clearTimeout(restartTimer)
    window.clearTimeout(endTimer)
    startTimer = stopTimer = restartTimer = endTimer = undefined
  }
  const emptyMessage = () => {
    if (noMatch || soundDetected) {
      return '听到了声音，但没有识别出文字。请靠近麦克风并放慢语速后重试。'
    }
    if (speechDetected) {
      return '已检测到说话，但浏览器没有返回文字。请检查语音服务网络，或直接输入文字。'
    }
    if (audioStarted) {
      return '麦克风已连接，但没有收到清晰语音。请检查系统输入音量和麦克风后重试。'
    }
    return '麦克风尚未准备好，录音已结束。请允许权限后等麦克风提示再说话。'
  }
  const finish = (message?: string, errorStatus: VoiceStatus = 'error') => {
    if (finished) return
    const text = textSoFar()
    const partial = retainedInterim || Boolean(attempt?.text && !attempt.final) || Boolean(interimBackup)
    const recognition = attempt?.recognition
    finished = true
    attempt = null
    clearTimers()
    // Invalidate callbacks before aborting: abort can synchronously emit end/error.
    if (recognition) abortSafely(recognition)
    if (text) {
      options.onTranscript(text)
      options.onComplete(text)
      options.onStatus(
        'complete',
        message
          ? `${message} 已保留并翻译已听到的文字，请核对。`
          : partial
            ? '已保留并翻译临时识别文字，浏览器尚未确认最终结果，请核对。'
            : '已识别并完成翻译，可以编辑文字后再次翻译。',
      )
    } else {
      options.onStatus(errorStatus, message ?? emptyMessage())
    }
  }

  const startAttempt = () => {
    if (finished || stopRequested) return
    let recognition: SpeechRecognition
    try {
      recognition = new options.Recognition()
    } catch {
      finish('无法开始语音识别，请重试或直接输入文字。')
      return
    }
    const next: Attempt = { recognition, text: '', final: false, ended: false }
    attempt = next
    recognition.lang = options.language
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    startTimer = window.setTimeout(() => {
      if (current(next)) finish('麦克风或语音服务启动超时，请检查浏览器权限与网络后重试。')
    }, START_TIMEOUT_MS)
    recognition.onstart = () => {
      if (!current(next)) return
      window.clearTimeout(startTimer)
      startTimer = undefined
      if (stopRequested) {
        // A stop requested during permission/startup must also stop a late start.
        try {
          recognition.stop()
        } catch {
          finish()
        }
        return
      }
      options.onStatus(
        'listening',
        options.hint || '麦克风已打开，请说完整的一句话；说完再点击结束。',
      )
    }
    recognition.onaudiostart = () => {
      if (!current(next)) return
      audioStarted = true
      if (!stopRequested) {
        options.onStatus('listening', options.hint || `已连接麦克风，请开始说${options.sourceLabel}。`)
      }
    }
    recognition.onsoundstart = () => {
      if (current(next)) soundDetected = true
    }
    recognition.onspeechstart = () => {
      if (!current(next)) return
      speechDetected = true
      if (!stopRequested) {
        options.onStatus('listening', `正在识别${options.sourceLabel}，请继续说完。`)
      }
    }
    recognition.onresult = (event) => {
      if (!current(next)) return
      let finalText = ''
      let interimText = ''
      // Results are a snapshot of this attempt, not incremental chunks to append.
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index]
        const value = result[0]?.transcript ?? ''
        if (result.isFinal) finalText += value
        else interimText += value
      }
      const text = `${finalText}${interimText}`.trim()
      // An empty interim update must not erase the last text we actually heard.
      if (!text) return
      next.text = text
      next.final = !interimText.trim()
      emptyRestarts = 0
      options.onTranscript(textSoFar())
      if (!stopRequested) {
        options.onStatus('listening', '已听到语音，可以继续说或点击结束。')
      }
    }
    recognition.onnomatch = () => {
      if (!current(next)) return
      noMatch = true
      if (!stopRequested) {
        options.onStatus('listening', '听到了声音，暂未识别出文字，请放慢语速继续说。')
      }
    }
    recognition.onerror = (event) => {
      if (!current(next)) return
      if (event.error === 'aborted' && stopRequested) {
        finish()
        return
      }
      if (event.error === 'no-speech') {
        // Wait for end before restarting; starting on error can hit InvalidStateError.
        if (!stopRequested) {
          options.onStatus('reconnecting', '暂时没有听到清晰语音，正在继续等待…')
          window.clearTimeout(endTimer)
          endTimer = window.setTimeout(() => {
            if (current(next)) finish('语音服务没有结束当前识别，请重试或直接输入文字。')
          }, STOP_TIMEOUT_MS)
        }
        return
      }
      if (event.error === 'not-allowed') {
        finish('麦克风权限未开启，请允许浏览器使用麦克风后重试。', 'permission-denied')
      } else if (event.error === 'service-not-allowed') {
        finish('当前浏览器的语音识别服务不可用，请换浏览器或直接输入文字。')
      } else if (event.error === 'audio-capture') {
        finish('没有检测到可用麦克风，请检查系统输入设备后重试。')
      } else if (event.error === 'language-not-supported') {
        finish('当前语音语言暂不受支持，请改用普通话或直接输入文字。')
      } else if (event.error === 'network') {
        finish('语音服务连接失败，请检查网络后重试。')
      } else {
        finish('语音识别暂时失败，请重试或直接输入文字。')
      }
    }
    recognition.onend = () => {
      if (!current(next) || next.ended) return
      next.ended = true
      window.clearTimeout(startTimer)
      window.clearTimeout(endTimer)
      startTimer = endTimer = undefined
      if (stopRequested) {
        if (next.text && next.final) finish()
        else endTimer = window.setTimeout(() => finish(), END_GRACE_MS)
        return
      }
      if (emptyRestarts >= MAX_EMPTY_RESTARTS) {
        finish(`语音识别反复结束。${emptyMessage()}`)
        return
      }
      emptyRestarts += 1
      options.onStatus('reconnecting', '识别暂时中断，正在重新连接，请稍候…')
      restartTimer = window.setTimeout(() => {
        restartTimer = undefined
        if (!current(next) || stopRequested) return
        if (next.final) {
          committedText = `${committedText}${next.text}`
        } else if (next.text) {
          interimBackup = `${committedText}${next.text}`.trim()
          retainedInterim = true
        }
        attempt = null
        startAttempt()
      }, RESTART_DELAY_MS)
    }
    try {
      recognition.start()
    } catch {
      finish('无法开始语音识别，请重试或直接输入文字。')
    }
  }

  return {
    start() {
      if (started || finished) return
      started = true
      options.onStatus('starting', '正在启动麦克风，请允许浏览器权限后稍候…')
      startAttempt()
    },
    requestStop() {
      if (finished || stopRequested) return
      stopRequested = true
      window.clearTimeout(startTimer)
      window.clearTimeout(restartTimer)
      window.clearTimeout(endTimer)
      startTimer = restartTimer = endTimer = undefined
      options.onStatus('stopping', '正在等待最后的文字，请稍候；再次点击可立即结束。')
      if (!attempt || attempt.ended) {
        finish()
        return
      }
      stopTimer = window.setTimeout(() => {
        finish('语音服务未及时返回最终结果，录音已结束。')
      }, STOP_TIMEOUT_MS)
      try {
        attempt.recognition.stop()
      } catch {
        finish()
      }
    },
    forceStop() {
      if (finished) return
      stopRequested = true
      finish()
    },
    cancel() {
      if (finished) return
      finished = true
      clearTimers()
      const recognition = attempt?.recognition
      attempt = null
      if (recognition) abortSafely(recognition)
    },
  }
}
