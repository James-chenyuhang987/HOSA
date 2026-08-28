import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(cleanup)

describe('HOSA application', () => {
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

  it('switches to the demo hospital map', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '院内地图' }))

    expect(screen.getByRole('heading', { name: '先看清楚，再出发' })).toBeInTheDocument()
    expect(screen.getByText('非实景 · 演示示意图')).toBeInTheDocument()
  })
})
