import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ChunkErrorReloader } from './ChunkErrorReloader'

const reload = vi.fn()

beforeEach(() => {
  // jsdom location.reload is a no-op/throws; stub it so we can assert on it.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { reload },
  })
  reload.mockClear()
  sessionStorage.clear()
})
afterEach(cleanup)

const fireError = (message: string) =>
  window.dispatchEvent(new ErrorEvent('error', { message }))

const fireRejection = (reason: unknown) =>
  window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason }))

describe('ChunkErrorReloader', () => {
  it('reloads the page on a ChunkLoadError (error event)', () => {
    render(<ChunkErrorReloader />)
    fireError('ChunkLoadError: Failed to load chunk /_next/static/app/page.js')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads on a ChunkLoadError surfaced as an unhandled rejection', () => {
    render(<ChunkErrorReloader />)
    fireRejection(new Error('ChunkLoadError: Failed to load chunk hmr-client'))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('ignores unrelated errors', () => {
    render(<ChunkErrorReloader />)
    fireError('TypeError: x is not a function')
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads at most once per episode (no reload loop)', () => {
    render(<ChunkErrorReloader />)
    fireError('ChunkLoadError: a')
    fireError('ChunkLoadError: b')
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
