import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const source = '我昨天晚上开始头晕，今天又吐了。'
const generated = '我由琴晚开始头晕，今日又呕咗。'
const modelResult = (text = generated) => Response.json({ text, provider: '测试翻译模型', needsReview: true })

beforeEach(() => {
  if (!window.localStorage) {
    const values = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } })
  }
  window.localStorage.removeItem('zhentu-language')
  window.localStorage.setItem('zhentu-onboarding-complete', 'true')
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function enableAndType(text = source) {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByText(/^翻译设置/u))
  await user.click(screen.getByRole('switch', { name: /使用本地模型补全/u }))
  await user.type(screen.getByLabelText('普通话内容'), text)
  return user
}

describe('hybrid translation', () => {
  it('keeps local-only mode offline and full phrase matches local even when models are enabled', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('普通话内容'), source)
    await user.click(screen.getByRole('button', { name: '立即翻译' }))
    expect(fetchMock).not.toHaveBeenCalled()
    await user.click(screen.getByText(/^翻译设置/u))
  await user.click(screen.getByRole('switch', { name: /使用本地模型补全/u }))
    await user.clear(screen.getByLabelText('普通话内容'))
    await user.type(screen.getByLabelText('普通话内容'), '我可能怀孕了')
    await user.click(screen.getByRole('button', { name: '立即翻译' }))
    expect(screen.getByText('我可能怀孕喇。')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends original input for an incomplete local translation and labels the model response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(modelResult())
    vi.stubGlobal('fetch', fetchMock)
    const user = await enableAndType()
    await user.click(screen.getByRole('button', { name: '立即翻译' }))
    expect(await screen.findByText(generated)).toBeInTheDocument()
    expect(screen.getByText('模型生成 · 待核对')).toBeInTheDocument()
    expect(screen.getByText('测试翻译模型')).toBeInTheDocument()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/translate')
    expect(JSON.parse(options.body)).toEqual({ text: source, dialect: 'cantonese', direction: 'toDialect' })
  })

  it('retains local reference when the backend is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const user = await enableAndType()
    await user.click(screen.getByRole('button', { name: '立即翻译' }))
    expect(await screen.findByText(/暂时连不上本地翻译服务/u)).toBeInTheDocument()
    expect(screen.queryByText('模型生成 · 待核对')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '复制译文' })).toBeInTheDocument()
  })

  it('cancels inference and prevents a late result from replacing edited input', async () => {
    let resolveRequest!: (value: Response) => void
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { resolveRequest = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    const user = await enableAndType()
    await user.click(screen.getByRole('button', { name: '立即翻译' }))
    expect(screen.getByRole('button', { name: '正在翻译…' })).toBeDisabled()
    await user.clear(screen.getByLabelText('普通话内容'))
    await user.type(screen.getByLabelText('普通话内容'), '我可能怀孕了')
    await user.click(screen.getByRole('button', { name: '立即翻译' }))
    await act(async () => { resolveRequest(modelResult()); await Promise.resolve() })
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    expect(screen.getByText('我可能怀孕喇。')).toBeInTheDocument()
    expect(screen.queryByText(generated)).not.toBeInTheDocument()
  })

  it('cancels an older request when the dialect changes and retains only the newer response', async () => {
    let resolveOld!: (value: Response) => void
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveOld = resolve }))
      .mockResolvedValueOnce(modelResult('我从昨晚起脑壳昏，今天又吐了。'))
    vi.stubGlobal('fetch', fetchMock)
    const user = await enableAndType()
    await user.click(screen.getByRole('button', { name: '立即翻译' }))
    await user.selectOptions(screen.getByLabelText('翻译成'), 'sichuan')
    expect(await screen.findByText('我从昨晚起脑壳昏，今天又吐了。')).toBeInTheDocument()
    await act(async () => { resolveOld(modelResult()); await Promise.resolve() })
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    expect(screen.queryByText(generated)).not.toBeInTheDocument()
  })

  it('lets the user cancel without discarding the local result', async () => {
    const fetchMock = vi.fn().mockImplementation(() => new Promise(() => {}))
    vi.stubGlobal('fetch', fetchMock)
    const user = await enableAndType()
    await user.click(screen.getByRole('button', { name: '立即翻译' }))
    await user.click(screen.getByRole('button', { name: '取消模型翻译' }))
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    expect(screen.getByRole('button', { name: '立即翻译' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '复制译文' })).toBeInTheDocument()
  })

  it('does not accept malformed model payloads as successful translations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ text: generated, provider: '模型', needsReview: false })))
    const user = await enableAndType()
    await user.click(screen.getByRole('button', { name: '立即翻译' }))
    expect(await screen.findByText(/模型返回内容无法确认/u)).toBeInTheDocument()
    expect(screen.queryByText(generated)).not.toBeInTheDocument()
  })

  it('shows an actionable error for a non-JSON backend response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>not an API</html>')))
    const user = await enableAndType()
    await user.click(screen.getByRole('button', { name: '立即翻译' }))
    expect(await screen.findByText(/后端没有返回可读取的数据/u)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '复制译文' })).toBeInTheDocument()
  })

  it('does not identify an unrelated service as the translation backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ service: 'unrelated', models: [] })))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByText(/^翻译设置/u))
    await user.click(screen.getByText('连接设置'))
    await user.click(screen.getByRole('button', { name: '检测连接' }))
    expect(await screen.findByText(/这个地址未返回诊途翻译服务/u)).toBeInTheDocument()
  })

  it('checks model readiness, uses a backend token only for the configured request, and clears stale connection status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ service: 'hosa-translation', models: [
      { id: 'hy', label: '腾讯 Hy-MT2', dialects: ['cantonese'], available: true },
      { id: 'taigi', label: '台语 Translator', dialects: ['minnan'], available: false },
    ] }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByText(/^翻译设置/u))
    await user.click(screen.getByText('连接设置'))
    await user.type(screen.getByLabelText('连接凭证（可选）'), 'test-token')
    await user.click(screen.getByRole('button', { name: '保存并应用' }))
    await user.click(screen.getByRole('button', { name: '检测连接' }))
    expect(await screen.findByText('服务已连接。模型推理可单独检测。')).toBeInTheDocument()
    expect(screen.getByText('未就绪')).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token')
    await user.clear(screen.getByLabelText('翻译后端地址'))
    expect(screen.getByText('服务已连接。模型推理可单独检测。')).toBeInTheDocument()
    await user.type(screen.getByLabelText('翻译后端地址'), '/other-api')
    await user.click(screen.getByRole('button', { name: '保存并应用' }))
    await waitFor(() => expect(screen.queryByText('服务已连接。模型推理可单独检测。')).not.toBeInTheDocument())
  })
})
