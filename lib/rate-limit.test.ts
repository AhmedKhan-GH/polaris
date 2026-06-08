import { describe, it, expect, vi } from 'vitest'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import { withRateLimit } from './rate-limit'

// Tests OUR withRateLimit guard against a real rate-limiter-flexible limiter
// (the library owns windowing/reset; we test our integration: allow → throw →
// skip fn → key isolation). No clock needed — assertions use the consume count.
const mk = (points: number) => new RateLimiterMemory({ points, duration: 60 })

describe('withRateLimit', () => {
  it('runs fn and returns its value when under the limit', async () => {
    const out = await withRateLimit(mk(1), 'k', async () => 'ok')
    expect(out).toBe('ok')
  })

  it('allows up to the limit then throws', async () => {
    const rl = mk(2)
    await withRateLimit(rl, 'k', async () => 1)
    await withRateLimit(rl, 'k', async () => 2)
    await expect(
      withRateLimit(rl, 'k', async () => 3),
    ).rejects.toThrow(/rate limit/i)
  })

  it('does not run fn when the limit is exceeded', async () => {
    const rl = mk(1)
    await withRateLimit(rl, 'k', async () => 'first')

    const fn = vi.fn()
    await expect(withRateLimit(rl, 'k', fn)).rejects.toThrow()
    expect(fn).not.toHaveBeenCalled()
  })

  it('tracks keys independently', async () => {
    const rl = mk(1)
    await withRateLimit(rl, 'a', async () => 'a')
    await withRateLimit(rl, 'b', async () => 'b') // different key — allowed
    await expect(withRateLimit(rl, 'a', async () => 'a2')).rejects.toThrow()
  })
})
