import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DashboardShell } from './DashboardShell'

afterEach(cleanup)

vi.mock('../auth/actions', () => ({
  signOutAction: vi.fn(),
}))

describe('DashboardShell', () => {
  test('renders log out button', () => {
    render(<DashboardShell><p>content</p></DashboardShell>)

    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()
  })

  test('renders back link to landing page', () => {
    render(<DashboardShell><p>content</p></DashboardShell>)

    expect(screen.getByRole('link', { name: /polaris/i })).toHaveAttribute('href', '/')
  })

  test('renders children', () => {
    render(<DashboardShell><p>dashboard content</p></DashboardShell>)

    expect(screen.getByText('dashboard content')).toBeInTheDocument()
  })
})
