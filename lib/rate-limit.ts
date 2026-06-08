// Fixed-window rate limiter. In-memory: state lives in this process, so it
// resets on restart and does NOT coordinate across instances — fine for the
// current single-instance internal tool. Swap the store for Redis/Upstash when
// scaling horizontally (see ROADMAP prod-hardening).

export type RateLimiter = {
  check(key: string): { allowed: boolean; retryAfterMs: number }
}

type Window = { count: number; resetAt: number }

export function createRateLimiter(opts: {
  limit: number
  windowMs: number
  now?: () => number
}): RateLimiter {
  const { limit, windowMs } = opts
  const now = opts.now ?? Date.now
  const windows = new Map<string, Window>()

  return {
    check(key) {
      const t = now()
      const w = windows.get(key)

      if (!w || t >= w.resetAt) {
        windows.set(key, { count: 1, resetAt: t + windowMs })
        return { allowed: true, retryAfterMs: 0 }
      }
      if (w.count >= limit) {
        return { allowed: false, retryAfterMs: w.resetAt - t }
      }
      w.count++
      return { allowed: true, retryAfterMs: 0 }
    },
  }
}

export async function withRateLimit<T>(
  limiter: RateLimiter,
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const { allowed, retryAfterMs } = limiter.check(key)
  if (!allowed) {
    throw new Error(
      `Rate limit exceeded. Retry in ${Math.ceil(retryAfterMs / 1000)}s`,
    )
  }
  return fn()
}

// Production limiter for order writes: 30 per minute per user.
export const orderWriteLimiter = createRateLimiter({
  limit: 30,
  windowMs: 60_000,
})
