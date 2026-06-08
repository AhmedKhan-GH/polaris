import { describe, it, expect, vi } from 'vitest'
import { createRateLimiter, withRateLimit } from './rate-limit'

describe('createRateLimiter', () => {
  it('allows up to the limit then blocks', () => {
    const rl = createRateLimiter({ limit: 3, windowMs: 1000, now: () => 0 })
    expect(rl.check('k').allowed).toBe(true)
    expect(rl.check('k').allowed).toBe(true)
    expect(rl.check('k').allowed).toBe(true)
    expect(rl.check('k').allowed).toBe(false)
  })

  it('resets after the window elapses', () => {
    let t = 0
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => t })
    expect(rl.check('k').allowed).toBe(true)
    expect(rl.check('k').allowed).toBe(false)
    t = 1000
    expect(rl.check('k').allowed).toBe(true)
  })

  it('tracks keys independently', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 })
    expect(rl.check('a').allowed).toBe(true)
    expect(rl.check('b').allowed).toBe(true)
    expect(rl.check('a').allowed).toBe(false)
  })

  it('reports a positive retryAfterMs when blocked', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 200 })
    rl.check('k')
    expect(rl.check('k').retryAfterMs).toBe(1000)
  })
})

describe('withRateLimit', () => {
  it('runs fn and returns its value when allowed', async () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 })
    const out = await withRateLimit(rl, 'k', async () => 'ok')
    expect(out).toBe('ok')
  })

  it('throws and does not run fn when blocked', async () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 })
    await withRateLimit(rl, 'k', async () => 'first')

    const fn = vi.fn()
    await expect(withRateLimit(rl, 'k', fn)).rejects.toThrow()
    expect(fn).not.toHaveBeenCalled()
  })
})
