import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(cleanup)

beforeEach(() => {
  window.localStorage.setItem('zhentu-onboarding-complete', 'true')
})

describe('诊途 application', () => {
  it('recommends a matching department from the symptom description', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('症状描述'), '最近三天胸闷心慌')
    await user.click(screen.getByRole('button', { name: '获取挂号建议' }))

    expect(screen.getByRole('heading', { name: '心血管内科' })).toBeInTheDocument()
    expect(screen.getByText('建议挂号科室')).toBeInTheDocument()
  })

  it('shows emergency guidance for red-flag symptoms', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('症状描述'), '突然剧烈胸痛并且呼吸困难')
    await user.click(screen.getByRole('button', { name: '获取挂号建议' }))

    expect(screen.getByText('紧急提示')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '急诊 / 立即拨打 120' }),
    ).toBeInTheDocument()
  })

  it('translates common Cantonese expressions into Mandarin', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '方言翻译' }))
    await user.selectOptions(screen.getByLabelText('选择方言'), 'cantonese')
    await user.type(screen.getByLabelText('方言内容'), '我唔舒服')
    await user.click(screen.getByRole('button', { name: '翻译成普通话' }))

    expect(screen.getByRole('heading', { name: '我不舒服' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '用于智能导诊' })).toBeInTheDocument()
  })

  it('guides a first-time user into the remote-care module', async () => {
    const user = userEvent.setup()
    window.localStorage.removeItem('zhentu-onboarding-complete')
    render(<App />)

    expect(screen.getByRole('dialog', { name: '先确定该挂什么科' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByRole('heading', { name: '把方言说法讲清楚' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.click(screen.getByRole('button', { name: '制定异地计划' }))

    expect(screen.getByRole('heading', { name: '去外地看病，也能心里有数' })).toBeInTheDocument()
    expect(window.localStorage.getItem('zhentu-onboarding-complete')).toBe('true')
  })

  it('records a dialect phrase and translates the recognized speech', async () => {
    class FakeSpeechRecognition {
      lang = ''
      interimResults = false
      continuous = false
      onresult: ((event: Event) => void) | null = null
      onerror: ((event: Event) => void) | null = null

      start() {
        this.onresult?.({
          results: {
            length: 1,
            0: { length: 1, 0: { transcript: '我唔舒服' } },
          },
        } as unknown as Event)
      }

      stop() {}
    }

    class FakeMediaRecorder {
      mimeType = 'audio/webm'
      state = 'inactive'
      ondataavailable: ((event: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null

      constructor(_stream: MediaStream) {}

      start() {
        this.state = 'recording'
      }

      stop() {
        this.state = 'inactive'
        this.ondataavailable?.({ data: new Blob(['audio']) })
        this.onstop?.()
      }
    }

    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: FakeSpeechRecognition,
    })
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: FakeMediaRecorder,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) },
    })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:recording'),
    })

    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '方言翻译' }))
    await user.selectOptions(screen.getByLabelText('选择方言'), 'cantonese')
    await user.click(screen.getByRole('button', { name: '开始录音翻译' }))
    await user.click(screen.getByRole('button', { name: '停止并翻译' }))

    expect(screen.getByRole('heading', { name: '我不舒服' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '停止并翻译' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '用于智能导诊' })).toBeInTheDocument()
  })

  it('tracks out-of-town care preparation progress', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '异地就医' }))
    await user.selectOptions(screen.getByLabelText('计划前往'), '上海')
    await user.click(screen.getByRole('button', { name: /确认医院、科室与号源/ }))

    expect(screen.getByText('上海就医准备单')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '异地就医准备进度' })).toHaveAttribute(
      'aria-valuenow',
      '20',
    )
    expect(screen.getByText('已完成 1 / 5 项')).toBeInTheDocument()
  })
})
