import { useCallback, useEffect, useRef, useState } from 'react'
import { matchingVoice } from './playbackVoice'
import type { PlaybackLanguage } from './playbackVoice'

type Props = {
  text: string; language: PlaybackLanguage; languageLabel: string; disabled?: boolean; complete?: boolean
}

export default function SpeechPlayback(props: Props) {
  return <PlaybackSession key={JSON.stringify([props.text, props.language, props.disabled, props.complete])} {...props} />
}

function PlaybackSession({ text, language, languageLabel, disabled = false, complete = true }: Props) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => window.speechSynthesis?.getVoices() ?? [])
  const key = JSON.stringify([text, language, disabled, complete])
  const [playback, setPlayback] = useState({ key, playing: false, error: '' })
  const playing = playback.key === key && playback.playing
  const error = playback.key === key ? playback.error : ''
  const epoch = useRef(0)
  const startupTimer = useRef<number | undefined>(undefined)
  const utterance = useRef<SpeechSynthesisUtterance | null>(null)
  const voice = typeof window.SpeechSynthesisUtterance === 'function' ? matchingVoice(voices, language) : undefined
  const cancelAudio = useCallback(() => {
    epoch.current += 1
    window.clearTimeout(startupTimer.current)
    if (utterance.current) window.speechSynthesis?.cancel()
    utterance.current = null
  }, [])
  const stop = () => { cancelAudio(); setPlayback({ key, playing: false, error: '' }) }

  useEffect(() => {
    const synth = window.speechSynthesis
    if (!synth) return
    const update = () => setVoices(synth.getVoices())
    synth.addEventListener('voiceschanged', update)
    return () => synth.removeEventListener('voiceschanged', update)
  }, [])
  useEffect(() => { cancelAudio(); return cancelAudio }, [key, cancelAudio])

  const toggle = () => {
    if (playing) { stop(); return }
    if (!voice || disabled || !complete || !window.SpeechSynthesisUtterance) return
    stop()
    const generation = epoch.current
    const message = new SpeechSynthesisUtterance(text)
    utterance.current = message
    message.voice = voice
    message.lang = voice.lang
    message.rate = 0.85
    message.onstart = () => { if (epoch.current === generation) window.clearTimeout(startupTimer.current) }
    message.onend = () => { if (epoch.current === generation) stop() }
    message.onerror = () => {
      if (epoch.current !== generation) return
      stop()
      setPlayback({ key, playing: false, error: '朗读未能完成，请重试或放大展示。' })
    }
    setPlayback({ key, playing: true, error: '' })
    startupTimer.current = window.setTimeout(() => {
      if (epoch.current !== generation) return
      stop()
      setPlayback({ key, playing: false, error: '朗读未能启动，请重试或放大展示。' })
    }, 10_000)
    try { window.speechSynthesis.speak(message) }
    catch { stop(); setPlayback({ key, playing: false, error: '此设备暂时无法朗读，请放大展示。' }) }
  }

  return <div className="speech-playback">
    <button type="button" onClick={toggle} disabled={disabled || !complete || !voice} aria-pressed={playing}>
      <span aria-hidden="true">{playing ? '■' : '▷'}</span> {playing ? '停止朗读' : `朗读${languageLabel}`}
    </button>
    {!disabled && <span className="playback-hint" role="status">{error || (!complete ? '整句尚未翻译，暂不朗读。'
      : !voice ? `此设备暂无${languageLabel}本地朗读，可放大展示。` : '使用设备本地语音')}</span>}
  </div>
}
