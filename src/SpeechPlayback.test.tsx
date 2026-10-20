import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import SpeechPlayback from './SpeechPlayback'
import { matchingVoice } from './playbackVoice'

const makeVoice = (lang: string, localService = true) => ({ lang, localService, name: lang, default: false, voiceURI: lang }) as SpeechSynthesisVoice
const mandarin = makeVoice('zh-CN')
const cantonese = makeVoice('zh-HK')
class Utterance {
  text: string
  voice: SpeechSynthesisVoice | null = null
  lang = ''
  rate = 1
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(text: string) { this.text = text }
}
let available: SpeechSynthesisVoice[]
let synth: EventTarget & { getVoices: () => SpeechSynthesisVoice[]; speak: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> }
beforeEach(() => {
  vi.useFakeTimers()
  available = [mandarin, cantonese]
  synth = Object.assign(new EventTarget(), { getVoices: () => available, speak: vi.fn(), cancel: vi.fn() })
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

it('only matches an explicitly supported local voice', () => {
  expect(matchingVoice([makeVoice('zh-TW'), mandarin], 'cantonese')).toBeUndefined()
  expect(matchingVoice([makeVoice('yue-Hant-HK')], 'cantonese')?.lang).toBe('yue-Hant-HK')
  expect(matchingVoice([mandarin, cantonese], 'sichuan')).toBeUndefined()
  expect(matchingVoice([mandarin, cantonese], 'minnan')).toBeUndefined()
  expect(matchingVoice([makeVoice('zh-CN', false)], 'mandarin')).toBeUndefined()
})

it('plays the matching dialect voice and lets the user stop it', () => {
  render(<SpeechPlayback text="我听唔清。" language="cantonese" languageLabel="粤语" />)
  fireEvent.click(screen.getByRole('button', { name: /朗读粤语/u }))
  const message = synth.speak.mock.calls[0][0] as Utterance
  expect(message.voice).toBe(cantonese)
  expect(message.text).toBe('我听唔清。')
  expect(message.rate).toBe(0.85)
  act(() => message.onstart?.())
  fireEvent.click(screen.getByRole('button', { name: /停止朗读/u }))
  expect(synth.cancel).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: /朗读粤语/u })).toHaveAttribute('aria-pressed', 'false')
})

it('stops on result changes and ignores events from the older playback', () => {
  const view = render(<SpeechPlayback text="第一句" language="mandarin" languageLabel="普通话" />)
  fireEvent.click(screen.getByRole('button', { name: /朗读普通话/u }))
  const old = synth.speak.mock.calls[0][0] as Utterance
  view.rerender(<SpeechPlayback text="第二句" language="mandarin" languageLabel="普通话" />)
  expect(synth.cancel).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: /朗读普通话/u }))
  act(() => old.onerror?.())
  expect(screen.getByRole('button', { name: /停止朗读/u })).toBeInTheDocument()
  expect(screen.queryByText(/朗读未能完成/u)).not.toBeInTheDocument()
  view.rerender(<SpeechPlayback text="第二句" language="mandarin" languageLabel="普通话" disabled />)
  expect(synth.cancel).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button')).toBeDisabled()
  view.rerender(<SpeechPlayback text="第二句" language="mandarin" languageLabel="普通话" />)
  expect(screen.getByRole('button', { name: /朗读普通话/u })).toHaveAttribute('aria-pressed', 'false')
})

it('updates when the device voices become available and cancels on unmount', () => {
  available = []
  const view = render(<SpeechPlayback text="你好。" language="cantonese" languageLabel="粤语" />)
  expect(screen.getByRole('button')).toBeDisabled()
  available = [cantonese]
  act(() => synth.dispatchEvent(new Event('voiceschanged')))
  fireEvent.click(screen.getByRole('button'))
  expect(synth.speak).toHaveBeenCalledTimes(1)
  view.unmount()
  expect(synth.cancel).toHaveBeenCalledTimes(1)
})

it('does not read an incomplete substitution or fall back for an unsupported dialect', () => {
  const view = render(<SpeechPlayback text="部分参考" language="cantonese" languageLabel="粤语" complete={false} />)
  expect(screen.getByRole('button')).toBeDisabled()
  expect(screen.getByText('整句尚未翻译，暂不朗读。')).toBeInTheDocument()
  view.rerender(<SpeechPlayback text="四川话参考" language="sichuan" languageLabel="四川话" />)
  expect(screen.getByRole('button')).toBeDisabled()
  expect(screen.getByText('此设备暂无四川话本地朗读，可放大展示。')).toBeInTheDocument()
  expect(synth.speak).not.toHaveBeenCalled()
})

it('recovers from playback errors and a startup that never completes', async () => {
  render(<SpeechPlayback text="你好。" language="mandarin" languageLabel="普通话" />)
  fireEvent.click(screen.getByRole('button'))
  act(() => (synth.speak.mock.calls[0][0] as Utterance).onerror?.())
  expect(screen.getByText('朗读未能完成，请重试或放大展示。')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button'))
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(screen.getByText('朗读未能启动，请重试或放大展示。')).toBeInTheDocument()
  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
})
