import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PageHeader } from './PageHeader'

vi.mock('../auth/actions', () => ({
  signOutAction: vi.fn(),
}))

afterEach(cleanup)

describe('PageHeader', () => {
  test('renders Polaris as link to landing page', () => {
    render(<PageHeader user={null} />)

    expect(screen.getByRole('link', { name: /polaris/i })).toHaveAttribute('href', '/')
  })

  test('shows log in link when unauthenticated', () => {
    render(<PageHeader user={null} />)

    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login')
  })

  test('shows log out button when authenticated', () => {
    render(<PageHeader user={{ id: '123' } as any} />)

    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()
  })

  test('does not show log in when authenticated', () => {
    render(<PageHeader user={{ id: '123' } as any} />)

    expect(screen.queryByRole('link', { name: /log in/i })).not.toBeInTheDocument()
  })

  test('hides auth button when hideAuth is true', () => {
    render(<PageHeader user={null} hideAuth />)

    expect(screen.queryByRole('link', { name: /log in/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument()
  })
})
