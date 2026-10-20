import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'

const input = () => screen.getByRole('textbox', { name: /内容$/u })
const enter = (text: string) => fireEvent.change(input(), { target: { value: text } })
const submit = () => fireEvent.click(screen.getByRole('button', { name: '立即翻译' }))
const result = () => screen.getByRole('complementary', { name: '翻译结果' })
const history = () => {
  fireEvent.click(screen.getByText('本页对话'))
  return screen.getByRole('list', { name: '本页对话记录' })
}
const health = (dialects = ['cantonese', 'sichuan']) => Response.json({ service: 'hosa-translation', models: [
  { id: 'test', label: '测试模型', dialects, available: true },
], asr: { configured: false } })
const model = (text = '整句模型译文') => Response.json({ text, provider: '测试模型', needsReview: true })

beforeEach(() => {
  vi.useFakeTimers()
  const values = new Map<string, string>([['zhentu-onboarding-complete', 'true']])
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('labels word substitutions as incomplete in the result and presentation', () => {
  render(<App />)
  enter('我从昨天晚上开始肚子疼，今天早上吐了两次，没有发烧。')
  submit()
  expect(within(result()).getByText('粤语用词参考')).toBeInTheDocument()
  expect(within(result()).queryByText('粤语译文')).not.toBeInTheDocument()
  expect(within(result()).getByText(/整句尚未完成翻译/u)).toBeInTheDocument()
  expect(within(result()).getByRole('button', { name: /朗读/u })).toBeDisabled()
  fireEvent.click(within(result()).getByRole('button', { name: /放大展示/u }))
  expect(within(screen.getByRole('dialog')).getByText(/粤语用词参考/u)).toBeInTheDocument()
  expect(within(screen.getByRole('dialog')).getByText('整句尚未完成翻译，以下仅为用词参考。')).toBeInTheDocument()
})

it('hands off to the other speaker with a blank draft and preserves the original turn', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  enter('我听不清医生说什么')
  submit()
  fireEvent.click(screen.getByRole('button', { name: /换对方说粤语/u }))
  expect(screen.getByLabelText('粤语内容')).toHaveValue('')
  expect(input()).toHaveFocus()
  expect(screen.getByRole('button', { name: '对方说粤语' })).toHaveAttribute('aria-pressed', 'true')
  await act(() => vi.advanceTimersByTimeAsync(1600))
  expect(fetchMock).not.toHaveBeenCalled()
  const transcript = history()
  expect(within(transcript).getByText('我听不清医生说什么')).toBeInTheDocument()
  expect(within(transcript).getByText('我听唔清医生讲乜。')).toBeInTheDocument()
})

it('keeps both sides of a conversation and restores an old sentence without another translation request', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  enter('你好')
  submit()
  fireEvent.click(screen.getByRole('button', { name: /换对方说粤语/u }))
  enter('唔该，洗手间喺边度？')
  submit()
  fireEvent.click(screen.getByRole('button', { name: '再说一句' }))
  const transcript = history()
  expect(within(transcript).getAllByRole('listitem')).toHaveLength(2)
  fireEvent.click(within(transcript).getByRole('button', { name: '编辑第 1 句原文' }))
  expect(screen.getByLabelText('普通话内容')).toHaveValue('你好')
  expect(within(result()).getByText('你好。')).toBeInTheDocument()
  await act(() => vi.advanceTimersByTimeAsync(1600))
  expect(fetchMock).not.toHaveBeenCalled()
})

it('captures a history snapshot for display and restores focus on closing', () => {
  render(<App />)
  enter('你好')
  submit()
  fireEvent.click(screen.getByRole('button', { name: '再说一句' }))
  const transcript = history()
  const show = within(transcript).getByRole('button', { name: '放大第 1 句' })
  show.focus()
  fireEvent.click(show)
  const dialog = screen.getByRole('dialog', { name: '请看这句话' })
  expect(within(dialog).getByText('你好')).toBeInTheDocument()
  expect(within(dialog).getByText('你好。')).toBeInTheDocument()
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(show).toHaveFocus()
})

it('bounds the temporary transcript and clears all medical text at the end of a conversation', () => {
  render(<App />)
  for (let index = 0; index < 22; index++) {
    enter(`本次就诊表达${index}`)
    submit()
    fireEvent.click(screen.getByRole('button', { name: '再说一句' }))
  }
  const transcript = history()
  expect(within(transcript).getAllByRole('listitem')).toHaveLength(20)
  expect(within(transcript).queryByText('本次就诊表达0')).not.toBeInTheDocument()
  expect(within(transcript).getAllByText('本次就诊表达21').length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: '结束并清空对话' }))
  expect(input()).toHaveValue('')
  expect(screen.getByText('本次对话已清空。')).toBeInTheDocument()
  expect(screen.queryByText('本次就诊表达21')).not.toBeInTheDocument()
  expect(within(result()).getByText('译文会显示在这里')).toBeInTheDocument()
})

it('starts a fresh empty conversation after a reload and only persists the language preference', () => {
  const store = vi.spyOn(window.localStorage, 'setItem')
  const view = render(<App />)
  enter('我没有药物过敏史')
  submit()
  fireEvent.click(screen.getByRole('button', { name: '再说一句' }))
  view.unmount()
  render(<App />)
  expect(input()).toHaveValue('')
  expect(screen.getByText('暂无记录')).toBeInTheDocument()
  expect(store.mock.calls.every(([key]) => key === 'zhentu-language')).toBe(true)
})

it('opens a relevant hospital scene without typing or submitting a translation', () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '打开过敏短句' }))
  expect(screen.getByRole('searchbox', { name: '查找医院短句' })).toHaveValue('过敏')
  const phrase = screen.getByRole('button', { name: '我没有药物过敏史' })
  expect(input()).toHaveValue('')
  fireEvent.click(phrase)
  expect(input()).toHaveValue('我没有药物过敏史')
  expect(within(result()).getByText('我冇药物过敏史。')).toBeInTheDocument()
  expect(result()).toHaveFocus()
})

it('warns about Mandarin recognition before recording a dialect that has no browser locale', () => {
  render(<App />)
  fireEvent.change(screen.getByLabelText('翻译成'), { target: { value: 'sichuan' } })
  fireEvent.click(screen.getByRole('button', { name: '对方说四川话' }))
  expect(screen.getByText('四川话录音目前按普通话识别，可能听不准；可用短句或文字沟通。')).toBeInTheDocument()
})

it('connects and translates a full sentence with a single opt-in and no address or token entry', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(health()).mockResolvedValueOnce(model())
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  enter('我昨天晚上开始头晕，今天又吐了。')
  submit()
  expect(fetchMock).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '一键开启' })))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0][0]).toBe('/api/health')
  expect(fetchMock.mock.calls[0][1].body).toBeUndefined()
  await act(() => vi.advanceTimersByTimeAsync(800))
  expect(within(result()).getByText('整句模型译文')).toBeInTheDocument()
  expect(fetchMock.mock.calls[1][0]).toBe('/api/translate')
  expect(screen.getByText('整句翻译已开启')).toBeInTheDocument()
})

it.each(['offline', 'unsupported'])('retains phrase mode when a one-click connection is %s', async (condition) => {
  const fetchMock = vi.fn()
  if (condition === 'offline') fetchMock.mockRejectedValue(new TypeError('offline'))
  else fetchMock.mockResolvedValue(health(['minnan']))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  enter('我昨天晚上开始头晕，今天又吐了。')
  submit()
  const reference = result().textContent
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '一键开启' })))
  expect(screen.getByText('整句服务暂不可用，医院短句仍可用')).toBeInTheDocument()
  await act(() => vi.advanceTimersByTimeAsync(1600))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('整句翻译已开启')).not.toBeInTheDocument()
  expect(result().textContent).toBe(reference)
})

it('clears the model result cache when a conversation ends', async () => {
  const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve(url.endsWith('/health') ? health() : model()))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '一键开启' })))
  enter('我昨天晚上开始头晕，今天又吐了。')
  await act(async () => submit())
  fireEvent.click(screen.getByRole('button', { name: '再说一句' }))
  history()
  fireEvent.click(screen.getByRole('button', { name: '结束并清空对话' }))
  enter('我昨天晚上开始头晕，今天又吐了。')
  await act(async () => submit())
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/translate'))).toHaveLength(2)
})

it('does not claim or call a model for a dialect missing from the connected service', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(health(['cantonese']))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '一键开启' })))
  fireEvent.change(screen.getByLabelText('翻译成'), { target: { value: 'sichuan' } })
  enter('我昨天晚上开始头晕，今天又吐了。')
  await act(async () => submit())
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(screen.getByText('当前方言整句服务暂不可用')).toBeInTheDocument()
  expect(screen.getByText('当前方言暂未接入整句翻译，已保留词库参考。')).toBeInTheDocument()
})
