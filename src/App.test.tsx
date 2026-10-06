import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

type MockSpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onaudiostart: (() => void) | null
  onspeechstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onnomatch: (() => void) | null
  onend: (() => void) | null
  startCalls: number
  start: () => void
  stop: () => void
  abort: () => void
  emitResult: (transcript: string) => void
  emitError: (error: string) => void
  emitNoMatch: () => void
}

class MockSpeechRecognition implements MockSpeechRecognitionInstance {
  static instances: MockSpeechRecognition[] = []
  static stopEmitsEnd = true
  static stopEmitsAbortError = false
  static stopEmitsNoMatch = false
  static startThrows = false
  lang = ''
  continuous = false
  interimResults = false
  maxAlternatives = 1
  onstart: (() => void) | null = null
  onaudiostart: (() => void) | null = null
  onspeechstart: (() => void) | null = null
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null
  onnomatch: (() => void) | null = null
  onend: (() => void) | null = null
  startCalls = 0

  constructor() {
    MockSpeechRecognition.instances.push(this)
  }

  start() {
    this.startCalls += 1
    if (MockSpeechRecognition.startThrows) throw new Error('start failed')
    this.onstart?.()
  }

  stop() {
    if (MockSpeechRecognition.stopEmitsAbortError) this.emitError('aborted')
    if (MockSpeechRecognition.stopEmitsNoMatch) this.emitNoMatch()
    if (MockSpeechRecognition.stopEmitsEnd) this.onend?.()
  }

  abort() {
    this.onend?.()
  }

  emitResult(transcript: string) {
    const result = {
      isFinal: true,
      length: 1,
      0: { transcript, confidence: 0.98 },
    }
    this.onresult?.({
      resultIndex: 0,
      results: { length: 1, 0: result },
    } as unknown as SpeechRecognitionEvent)
  }

  emitError(error: string) {
    this.onerror?.({ error, message: '' } as SpeechRecognitionErrorEvent)
  }

  emitNoMatch() {
    this.onnomatch?.()
  }
}

function installSpeechRecognition() {
  MockSpeechRecognition.instances = []
  MockSpeechRecognition.stopEmitsEnd = true
  MockSpeechRecognition.stopEmitsAbortError = false
  MockSpeechRecognition.stopEmitsNoMatch = false
  MockSpeechRecognition.startThrows = false
  window.SpeechRecognition = MockSpeechRecognition as unknown as SpeechRecognitionConstructor
  return MockSpeechRecognition
}

afterEach(() => {
  cleanup()
  delete window.SpeechRecognition
  delete window.webkitSpeechRecognition
  MockSpeechRecognition.instances = []
  MockSpeechRecognition.stopEmitsEnd = true
  MockSpeechRecognition.stopEmitsAbortError = false
  MockSpeechRecognition.stopEmitsNoMatch = false
  MockSpeechRecognition.startThrows = false
  vi.useRealTimers()
})

beforeEach(() => {
  if (!window.localStorage) {
    const values = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    })
  }
  window.localStorage.setItem('zhentu-onboarding-complete', 'true')
})

describe('诊途 application', () => {
  it('translates a Mandarin medical phrase into Cantonese', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('普通话内容'), '我听不清医生说什么')
    await user.click(screen.getByRole('button', { name: '翻译这句话' }))

    expect(screen.getByText('我听唔清医生讲乜。')).toBeInTheDocument()
    expect(screen.getByText('读法参考')).toBeInTheDocument()
    expect(screen.getByText('沟通提示')).toBeInTheDocument()
  })

  it('updates the result when the target dialect changes', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('普通话内容'), '你好')
    await user.selectOptions(screen.getByLabelText('翻译成'), 'shanghai')

    expect(screen.getByText('侬好。')).toBeInTheDocument()
    expect(screen.getByText('上海话译文')).toBeInTheDocument()
  })

  it('translates a Cantonese phrase back into Mandarin', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '交换翻译方向' }))
    await user.type(screen.getByLabelText('粤语内容'), '我听唔清医生讲乜')
    await user.click(screen.getByRole('button', { name: '翻译这句话' }))

    expect(screen.getByText('我听不清医生说什么。')).toBeInTheDocument()
    expect(screen.getByText('普通话译文')).toBeInTheDocument()
  })

  it('normalizes punctuation when matching a reverse phrase', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '交换翻译方向' }))
    await user.type(screen.getByLabelText('粤语内容'), '唔该，洗手间喺边度')
    await user.click(screen.getByRole('button', { name: '翻译这句话' }))

    expect(screen.getByText('请问洗手间在哪里。')).toBeInTheDocument()
  })

  it('offers Sichuan dialect phrases with a regional accuracy note', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('普通话内容'), '我听不清医生说什么')
    await user.selectOptions(screen.getByLabelText('翻译成'), 'sichuan')

    expect(screen.getByText('我听不清医生在说啥子。')).toBeInTheDocument()
    expect(screen.getByText('常用短句')).toBeInTheDocument()
    expect(screen.getByText(/四川各地读音不同/)).toBeInTheDocument()
  })

  it('translates the Mandarin identity phrase into Minnan with a pronunciation', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('普通话内容'), '你好，我是中国人')
    await user.selectOptions(screen.getByLabelText('翻译成'), 'minnan')

    expect(screen.getByText('你好，我是中國人。')).toBeInTheDocument()
    expect(screen.getByText('lí hó, guá sī Tiong-kok lâng')).toBeInTheDocument()
    expect(screen.queryByText('暂未提供读法')).not.toBeInTheDocument()
  })

  it('covers hospital registration and department questions', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('普通话内容'), '请问挂号处在哪里')
    await user.click(screen.getByRole('button', { name: '翻译这句话' }))
    expect(screen.getByText('唔该，挂号处喺边度？')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('翻译成'), 'sichuan')
    expect(screen.getByText('挂号的地方在哪点？')).toBeInTheDocument()
  })

  it('adds medication instructions and follow-up phrases for Northeast dialect', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('普通话内容'), '这个药怎么吃')
    await user.selectOptions(screen.getByLabelText('翻译成'), 'northeast')
    expect(screen.getByText('这药咋吃？')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('普通话内容'))
    await user.type(screen.getByLabelText('普通话内容'), '什么时候复诊')
    await user.click(screen.getByRole('button', { name: '翻译这句话' }))
    expect(screen.getByText('啥时候回来复诊？')).toBeInTheDocument()
  })

  it('covers examination, pregnancy, and insurance phrases in the hospital lexicon', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('普通话内容'), '我怀孕了')
    await user.click(screen.getByRole('button', { name: '翻译这句话' }))
    expect(screen.getByText('我怀孕喇。')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('普通话内容'))
    await user.selectOptions(screen.getByLabelText('翻译成'), 'sichuan')
    await user.type(screen.getByLabelText('普通话内容'), '我要验血')
    await user.click(screen.getByRole('button', { name: '翻译这句话' }))
    expect(screen.getByText('我要验血嘛。')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('普通话内容'))
    await user.selectOptions(screen.getByLabelText('翻译成'), 'minnan')
    await user.type(screen.getByLabelText('普通话内容'), '可以用医保吗')
    await user.click(screen.getByRole('button', { name: '翻译这句话' }))
    expect(screen.getByText('會當用健保無？')).toBeInTheDocument()
  })

  it('translates ordinary hospital questions with generic dialect wording', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('普通话内容'), '请问医院在哪里？')
    await user.selectOptions(screen.getByLabelText('翻译成'), 'minnan')
    await user.click(screen.getByRole('button', { name: '翻译这句话' }))
    expect(screen.getByText('請問醫院佇佗位？')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('普通话内容'))
    await user.selectOptions(screen.getByLabelText('翻译成'), 'shanghai')
    await user.type(screen.getByLabelText('普通话内容'), '请问医院在哪里？')
    await user.click(screen.getByRole('button', { name: '翻译这句话' }))
    expect(screen.getByText('请问医院勒啥地方？')).toBeInTheDocument()
  })

  it('marks dialect word substitutions as reference wording', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('普通话内容'), '怎么办')
    await user.selectOptions(screen.getByLabelText('翻译成'), 'northeast')

    expect(screen.getByText('咋整。')).toBeInTheDocument()
    expect(screen.getByText('词语参考')).toBeInTheDocument()
  })

  it('requires source text before translating', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '翻译这句话' }))

    expect(screen.getByText('请先输入想翻译的普通话。')).toBeInTheDocument()
  })

  it('offers a hospital map without restoring the retired workflow modules', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: '医院地图' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '就医流程' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '异地就医' })).not.toBeInTheDocument()
  })

  it('preserves the translation when visiting the hospital map', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('普通话内容'), '我听不清医生说什么')
    await user.click(screen.getByRole('button', { name: '翻译这句话' }))
    await user.click(screen.getByRole('button', { name: '医院地图' }))
    expect(screen.getByRole('heading', { name: '先看清楚，再出发' })).toBeInTheDocument()
    expect(screen.queryByLabelText('普通话内容')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '方言翻译' }))
    expect(screen.getByLabelText('普通话内容')).toHaveValue('我听不清医生说什么')
    expect(screen.getByText('我听唔清医生讲乜。')).toBeInTheDocument()
  })

  it('keeps the recording controls visible until voice input finishes', async () => {
    const user = userEvent.setup()
    const Recognition = installSpeechRecognition()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始录音' }))
    expect(screen.getByRole('button', { name: '医院地图' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '医院地图' }))
    expect(screen.getByRole('button', { name: '结束录音' })).toBeInTheDocument()

    Recognition.instances[0].emitResult('你好')
    await user.click(screen.getByRole('button', { name: '结束录音' }))
    expect(screen.getByRole('button', { name: '医院地图' })).toBeEnabled()
  })

  it('guides a first-time user into the dialect translator', async () => {
    const user = userEvent.setup()
    window.localStorage.removeItem('zhentu-onboarding-complete')
    render(<App />)

    expect(screen.getByRole('dialog', { name: '先把想说的话翻译好' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '开始翻译' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.localStorage.getItem('zhentu-onboarding-complete')).toBe('true')
  })

  it('transcribes voice input and translates the final text', async () => {
    const user = userEvent.setup()
    const Recognition = installSpeechRecognition()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始录音' }))
    expect(screen.getByRole('button', { name: '结束录音' })).toBeInTheDocument()
    expect(Recognition.instances[0].lang).toBe('zh-CN')

    Recognition.instances[0].emitResult('我听不清医生说什么')
    await user.click(screen.getByRole('button', { name: '结束录音' }))

    expect(screen.getByLabelText('普通话内容')).toHaveValue('我听不清医生说什么')
    expect(Recognition.instances[0].continuous).toBe(true)
    expect(screen.getByText('我听唔清医生讲乜。')).toBeInTheDocument()
    expect(screen.getByText('已识别并完成翻译，可以编辑文字后再次翻译。')).toBeInTheDocument()
  })

  it('falls back to abort when the browser delays the end callback', async () => {
    const user = userEvent.setup()
    const Recognition = installSpeechRecognition()
    Recognition.stopEmitsEnd = false
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始录音' }))
    await user.click(screen.getByRole('button', { name: '结束录音' }))

    expect(screen.getByRole('button', { name: '立即结束录音' })).toBeEnabled()
    await new Promise((resolve) => setTimeout(resolve, 5200))

    expect(screen.getByRole('button', { name: '开始录音' })).toBeInTheDocument()
  }, 10000)

  it('allows a force stop when the browser does not finish recording', async () => {
    const user = userEvent.setup()
    const Recognition = installSpeechRecognition()
    Recognition.stopEmitsEnd = false
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始录音' }))
    await user.click(screen.getByRole('button', { name: '结束录音' }))
    await user.click(screen.getByRole('button', { name: '立即结束录音' }))

    expect(screen.getByRole('button', { name: '开始录音' })).toBeInTheDocument()
  })

  it('keeps the transcript when stopping emits an aborted event', async () => {
    const user = userEvent.setup()
    const Recognition = installSpeechRecognition()
    Recognition.stopEmitsAbortError = true
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始录音' }))
    Recognition.instances[0].emitResult('我听不清医生说什么')
    await user.click(screen.getByRole('button', { name: '结束录音' }))

    expect(screen.getByText('我听唔清医生讲乜。')).toBeInTheDocument()
    expect(screen.getByText('已识别并完成翻译，可以编辑文字后再次翻译。')).toBeInTheDocument()
  })

  it('keeps a final result that arrives just after the end event', async () => {
    const user = userEvent.setup()
    const Recognition = installSpeechRecognition()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始录音' }))
    await user.click(screen.getByRole('button', { name: '结束录音' }))
    Recognition.instances[0].emitResult('我听不清医生说什么')

    expect(await screen.findByText('我听唔清医生讲乜。')).toBeInTheDocument()
    expect(screen.getByLabelText('普通话内容')).toHaveValue('我听不清医生说什么')
  })

  it('keeps waiting after a brief no-speech event', async () => {
    const user = userEvent.setup()
    const Recognition = installSpeechRecognition()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始录音' }))
    Recognition.instances[0].emitError('no-speech')
    Recognition.instances[0].onend?.()
    await new Promise((resolve) => setTimeout(resolve, 320))

    expect(Recognition.instances).toHaveLength(2)
    expect(Recognition.instances[1].startCalls).toBe(1)
    expect(screen.getByRole('button', { name: '结束录音' })).toBeInTheDocument()
  })

  it('keeps a partial transcript when the recognition service fails afterwards', async () => {
    const user = userEvent.setup()
    const Recognition = installSpeechRecognition()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始录音' }))
    Recognition.instances[0].emitResult('我听不清医生说什么')
    Recognition.instances[0].emitError('network')

    expect(await screen.findByLabelText('普通话内容')).toHaveValue('我听不清医生说什么')
    expect(await screen.findByText('我听唔清医生讲乜。')).toBeInTheDocument()
    expect(
      await screen.findByText('语音服务连接失败，请检查网络后重试。 已保留并翻译已听到的文字，请核对。'),
    ).toBeInTheDocument()
  })

  it('allows retrying after the browser rejects start', async () => {
    const user = userEvent.setup()
    const Recognition = installSpeechRecognition()
    Recognition.startThrows = true
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始录音' }))
    expect(screen.getByText('无法开始语音识别，请重试或直接输入文字。')).toBeInTheDocument()

    Recognition.startThrows = false
    await user.click(screen.getByRole('button', { name: '开始录音' }))
    expect(screen.getByRole('button', { name: '结束录音' })).toBeInTheDocument()
  })

  it('uses the Cantonese speech locale when translating back to Mandarin', async () => {
    const user = userEvent.setup()
    const Recognition = installSpeechRecognition()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '交换翻译方向' }))
    await user.click(screen.getByRole('button', { name: '开始录音' }))

    expect(Recognition.instances[0].lang).toBe('zh-HK')
    expect(screen.getByText('麦克风已打开，请说完整的一句话；说完再点击结束。')).toBeInTheDocument()
  })

  it('reports microphone permission failures', async () => {
    const user = userEvent.setup()
    const Recognition = installSpeechRecognition()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始录音' }))
    Recognition.instances[0].emitError('not-allowed')

    expect(await screen.findByText('麦克风权限未开启，请允许浏览器使用麦克风后重试。')).toBeInTheDocument()
  })

  it('explains when the browser hears sound but returns no transcript', async () => {
    const user = userEvent.setup()
    const Recognition = installSpeechRecognition()
    Recognition.stopEmitsNoMatch = true
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始录音' }))
    await user.click(screen.getByRole('button', { name: '结束录音' }))

    expect(
      await screen.findByText('听到了声音，但没有识别出文字。请靠近麦克风并放慢语速后重试。'),
    ).toBeInTheDocument()
  })

  it('falls back to text input when speech recognition is unavailable', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始录音' }))

    expect(screen.getByText('当前浏览器不支持语音识别，请直接输入文字。')).toBeInTheDocument()
  })
})
