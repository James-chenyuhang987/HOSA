import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'

const first = '我听不清医生说什么'
const firstResult = '我听唔清医生讲乜。'
const tick = async (milliseconds: number) => { await act(() => vi.advanceTimersByTimeAsync(milliseconds)) }
const enter = (value: string) => fireEvent.change(screen.getByLabelText('普通话内容'), { target: { value } })
const translate = () => fireEvent.click(screen.getByRole('button', { name: '立即翻译' }))
const settings = () => fireEvent.click(screen.getByText(/^翻译设置/u))

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

it('automatically translates after an 800ms pause and restarts the delay on edits', async () => {
  render(<App />)
  enter('我听不清医生')
  await tick(799)
  expect(screen.getByText('译文会显示在这里')).toBeInTheDocument()
  enter(first)
  await tick(799)
  expect(screen.queryByText(firstResult)).not.toBeInTheDocument()
  await tick(1)
  expect(screen.getByText(firstResult)).toBeInTheDocument()
})

it('waits until Chinese IME composition ends before scheduling translation', async () => {
  render(<App />)
  const input = screen.getByLabelText('普通话内容')
  fireEvent.compositionStart(input)
  enter(first)
  await tick(2000)
  expect(screen.queryByText(firstResult)).not.toBeInTheDocument()
  fireEvent.compositionEnd(input)
  await tick(799)
  expect(screen.queryByText(firstResult)).not.toBeInTheDocument()
  await tick(1)
  expect(screen.getByText(firstResult)).toBeInTheDocument()
})

it('keeps the previous result visible but disables sharing until it matches the draft', async () => {
  render(<App />)
  enter(first)
  translate()
  enter('你好')
  expect(screen.getByText(firstResult)).toBeInTheDocument()
  expect(screen.getByText(/以下为上一条结果/u)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '复制译文' })).toBeDisabled()
  expect(screen.getByRole('button', { name: /放大展示/u })).toBeDisabled()
  await tick(800)
  expect(screen.getByText('你好。')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /放大展示/u })).toBeEnabled()
})

it('does not use an old translation as the source when swapping direction', () => {
  render(<App />)
  enter(first)
  translate()
  enter('新输入的文字')
  fireEvent.click(screen.getByRole('button', { name: '交换翻译方向' }))
  expect(screen.getByLabelText('粤语内容')).toHaveValue('新输入的文字')
})

it('clearing cancels the pending debounce and removes the previous result', async () => {
  render(<App />)
  enter(first)
  translate()
  enter('你好')
  fireEvent.click(screen.getByRole('button', { name: '清空内容' }))
  await tick(2000)
  expect(screen.getByText('译文会显示在这里')).toBeInTheDocument()
  expect(screen.getByLabelText('普通话内容')).toHaveValue('')
  expect(screen.getByText('点击麦克风说话，或直接输入文字。')).toBeInTheDocument()
})

it('does not submit twice when immediately translating before the debounce expires', async () => {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ text: '模型译文', provider: '测试模型', needsReview: true })))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  settings()
  fireEvent.click(screen.getByRole('switch', { name: /使用本地模型补全/u }))
  enter('我昨天晚上开始头晕，今天又吐了。')
  await act(async () => translate())
  await tick(1600)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('shows both languages in the large view, traps focus and restores it on Escape', () => {
  render(<App />)
  enter(first)
  translate()
  const show = screen.getByRole('button', { name: /放大展示/u })
  show.focus()
  fireEvent.click(show)
  const dialog = screen.getByRole('dialog', { name: '请看这句话' })
  expect(within(dialog).getByText(first)).toBeInTheDocument()
  expect(within(dialog).getByText(firstResult)).toBeInTheDocument()
  const close = within(dialog).getByRole('button', { name: '关闭展示' })
  const lastControl = within(dialog).getByRole('button', { name: '放大字号' })
  expect(close).toHaveFocus()
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
  expect(lastControl).toHaveFocus()
  fireEvent.keyDown(lastControl, { key: 'Tab' })
  expect(close).toHaveFocus()
  fireEvent.keyDown(close, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(show).toHaveFocus()
})

it('keeps typing focused and lets the user move to the result explicitly', async () => {
  render(<App />)
  const input = screen.getByLabelText('普通话内容')
  input.focus()
  enter(first)
  await tick(800)
  expect(input).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: /查看译文/u }))
  expect(screen.getByRole('complementary', { name: '翻译结果' })).toHaveFocus()
  input.focus()
  enter('你好')
  translate()
  expect(screen.getByRole('complementary', { name: '翻译结果' })).toHaveFocus()
  expect(screen.getByText('你好。')).toBeInTheDocument()
})

it.each(['ctrlKey', 'metaKey'])('submits immediately with %s + Enter, but waits during IME composition', async (modifier) => {
  render(<App />)
  const input = screen.getByLabelText('普通话内容')
  input.focus()
  fireEvent.compositionStart(input)
  enter(first)
  fireEvent.keyDown(input, { key: 'Enter', [modifier]: true })
  expect(screen.queryByText(firstResult)).not.toBeInTheDocument()
  expect(input).toHaveFocus()
  fireEvent.compositionEnd(input)
  fireEvent.keyDown(input, { key: 'Enter', [modifier]: true })
  expect(screen.getByText(firstResult)).toBeInTheDocument()
  expect(screen.getByRole('complementary', { name: '翻译结果' })).toHaveFocus()
  await tick(800)
  expect(screen.getByText(firstResult)).toBeInTheDocument()
})

it('adjusts presentation text size within readable bounds', () => {
  render(<App />)
  enter(first)
  translate()
  fireEvent.click(screen.getByRole('button', { name: /放大展示/u }))
  const dialog = screen.getByRole('dialog', { name: '请看这句话' })
  const smaller = within(dialog).getByRole('button', { name: '缩小字号' })
  const larger = within(dialog).getByRole('button', { name: '放大字号' })
  expect(within(dialog).getByLabelText('当前字号')).toHaveTextContent('40')
  for (let index = 0; index < 20; index++) fireEvent.click(larger)
  expect(larger).toBeDisabled()
  expect(within(dialog).getByText(firstResult)).toHaveStyle({ fontSize: '64px' })
  for (let index = 0; index < 20; index++) fireEvent.click(smaller)
  expect(smaller).toBeDisabled()
  expect(within(dialog).getByText(firstResult)).toHaveStyle({ fontSize: '28px' })
})

it('keeps the displayed text fixed while a model updates the result behind it', async () => {
  let resolve!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((done) => { resolve = done })))
  render(<App />)
  settings()
  fireEvent.click(screen.getByRole('switch', { name: /使用本地模型补全/u }))
  enter('我昨天晚上开始头晕，今天又吐了。')
  translate()
  const result = screen.getByRole('complementary', { name: '翻译结果' })
  const reference = result.querySelector('.translated-text')!.textContent!
  fireEvent.click(screen.getByRole('button', { name: /放大展示/u }))
  const dialog = screen.getByRole('dialog', { name: '请看这句话' })
  await act(async () => { resolve(Response.json({ text: '模型补译完成', provider: '测试模型', needsReview: true })) })
  expect(within(result).getByText('模型补译完成')).toBeInTheDocument()
  expect(dialog.querySelector('.presentation-translation')).toHaveTextContent(reference)
  expect(within(dialog).queryByText('模型补译完成')).not.toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: '关闭展示' }))
  fireEvent.click(screen.getByRole('button', { name: /放大展示/u }))
  expect(within(screen.getByRole('dialog')).getByText('模型补译完成')).toBeInTheDocument()
})

it('opens the settings for an uncovered phrase without enabling models or sending text', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  enter('尚未收录的表达XYZ')
  translate()
  fireEvent.click(screen.getByRole('button', { name: '打开翻译设置' }))
  const modelSwitch = screen.getByRole('switch', { name: /使用本地模型补全/u })
  expect(modelSwitch).toHaveFocus()
  expect(modelSwitch).not.toBeChecked()
  await tick(1600)
  expect(fetchMock).not.toHaveBeenCalled()
})

it('stops model translation explicitly without automatically restarting it', async () => {
  let resolve!: (response: Response) => void
  const fetchMock = vi.fn(() => new Promise<Response>((done) => { resolve = done }))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  settings()
  fireEvent.click(screen.getByRole('switch', { name: /使用本地模型补全/u }))
  enter('我昨天晚上开始头晕，今天又吐了。')
  translate()
  const reference = screen.getByRole('complementary', { name: '翻译结果' }).textContent
  fireEvent.click(screen.getByRole('button', { name: '取消模型翻译' }))
  expect(screen.getByText('已停止模型翻译，保留词库参考。')).toBeInTheDocument()
  await act(async () => { resolve(Response.json({ text: '迟到的模型译文', provider: '测试模型', needsReview: true })) })
  await tick(1600)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('complementary', { name: '翻译结果' }).textContent).toBe(reference)
  expect(screen.queryByText('迟到的模型译文')).not.toBeInTheDocument()
})

it.each(['edit', 'model'])('does not report a pending copy as the current result after %s changes it', async (change) => {
  let finishCopy!: () => void
  let resolveModel!: (response: Response) => void
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText: vi.fn(() => new Promise<void>((done) => { finishCopy = done })),
  } })
  try {
    render(<App />)
    if (change === 'model') {
      vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((done) => { resolveModel = done })))
      settings()
      fireEvent.click(screen.getByRole('switch', { name: /使用本地模型补全/u }))
      enter('我昨天晚上开始头晕，今天又吐了。')
    } else enter(first)
    translate()
    fireEvent.click(screen.getByRole('button', { name: '复制译文' }))
    if (change === 'model') {
      await act(async () => { resolveModel(Response.json({ text: '新的模型译文', provider: '测试模型', needsReview: true })) })
    } else {
      enter('你好')
      translate()
    }
    await act(async () => { finishCopy() })
    expect(screen.queryByText('已复制')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '复制译文' })).toBeEnabled()
  } finally {
    if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor)
    else delete (navigator as { clipboard?: unknown }).clipboard
  }
})

it('provides a useful fallback when clipboard access is unavailable', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
  try {
    render(<App />)
    enter(first)
    translate()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '复制译文' })))
    expect(screen.getByText('复制失败，请长按译文选择并复制。')).toBeInTheDocument()
  } finally {
    if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor)
    else delete (navigator as { clipboard?: unknown }).clipboard
  }
})

it('uses hospital phrase categories and immediately translates the selected phrase', () => {
  render(<App />)
  fireEvent.click(screen.getByText('医院常用短句'))
  fireEvent.click(screen.getByRole('button', { name: '用药' }))
  const phrase = screen.getByRole('button', { name: /这个药一天吃几次/u })
  fireEvent.click(phrase)
  expect(screen.getByLabelText('普通话内容')).toHaveValue('这个药一天吃几次')
  expect(screen.getByText('呢只药一日食几次？')).toBeInTheDocument()
  expect(screen.getByRole('complementary', { name: '翻译结果' })).toHaveFocus()
})

it('remembers only the language preference, with an empty draft on a new page', () => {
  const view = render(<App />)
  fireEvent.change(screen.getByLabelText('翻译成'), { target: { value: 'sichuan' } })
  fireEvent.click(screen.getByRole('button', { name: '交换翻译方向' }))
  fireEvent.change(screen.getByLabelText('四川话内容'), { target: { value: '私密的症状' } })
  expect(window.localStorage.getItem('zhentu-language')).toBe(JSON.stringify({ dialect: 'sichuan', direction: 'toMandarin' }))
  view.unmount()
  render(<App />)
  expect(screen.getByLabelText('四川话内容')).toHaveValue('')
  expect(screen.getByLabelText('方言来自')).toHaveValue('sichuan')
})

it('does not discard the result while editing connection settings, and only applies them on save', () => {
  render(<App />)
  enter(first)
  translate()
  settings()
  fireEvent.click(screen.getByText('连接设置'))
  fireEvent.change(screen.getByLabelText('翻译后端地址'), { target: { value: '/api2' } })
  expect(screen.getByText(firstResult)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '复制译文' })).toBeEnabled()
  expect(screen.getByRole('button', { name: '检测连接' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '保存并应用' }))
  expect(screen.getByText(firstResult)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '复制译文' })).toBeDisabled()
})
