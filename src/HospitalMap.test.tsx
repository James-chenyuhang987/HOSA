import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import HospitalMap from './HospitalMap'

afterEach(cleanup)

describe('hospital demonstration map', () => {
  it('resets to a valid floor and shows building-specific services when changing buildings', async () => {
    const user = userEvent.setup()
    render(<HospitalMap />)

    await user.click(screen.getByRole('button', { name: '3F' }))
    expect(screen.getByRole('button', { name: '神经内科' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^急诊楼$/ }))

    expect(screen.getByRole('button', { name: '1F' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: '3F' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '急诊分诊' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '神经内科' })).not.toBeInTheDocument()
    expect(screen.getByText('无障碍入口')).toBeInTheDocument()
  })

  it('locates a search result in the right building and floor', async () => {
    const user = userEvent.setup()
    render(<HospitalMap />)

    await user.type(screen.getByLabelText('想去哪里？'), '超声')
    const results = screen.getByRole('list', { name: '地图搜索结果' })
    await user.click(within(results).getByRole('button', { name: /超声检查/ }))

    expect(screen.getByRole('button', { name: /^检查楼$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '2F' })).toHaveAttribute('aria-pressed', 'true')
    const plan = screen.getByRole('group', { name: '检查楼 2F 楼层示意图' })
    expect(within(plan).getByRole('button', { name: '超声检查' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('已选：超声检查 · 检查楼 2F')).toBeInTheDocument()
  })

  it('handles an unknown destination and clears the search', async () => {
    const user = userEvent.setup()
    render(<HospitalMap />)

    await user.type(screen.getByLabelText('想去哪里？'), '不存在的地方')
    expect(screen.getByText('没有找到这个地点，请换个关键词或查看各楼层。')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '清空地图搜索' }))

    expect(screen.getByLabelText('想去哪里？')).toHaveValue('')
    expect(screen.queryByRole('list', { name: '地图搜索结果' })).not.toBeInTheDocument()
    expect(screen.getByText('演示示意图 · 非真实院区')).toBeInTheDocument()
  })

  it('finds services in multiple buildings using the common destination shortcuts', async () => {
    const user = userEvent.setup()
    render(<HospitalMap />)

    const shortcuts = screen.getByRole('group', { name: '常用地图目的地' })
    await user.click(within(shortcuts).getByRole('button', { name: '卫生间' }))
    const results = screen.getByRole('list', { name: '地图搜索结果' })
    expect(within(results).getAllByRole('button')).toHaveLength(7)
    await user.click(within(results).getByRole('button', { name: /无障碍卫生间急诊楼/ }))
    expect(screen.getByText('已选：无障碍卫生间 · 急诊楼 1F')).toBeInTheDocument()
  })
})
