import { RateLimiterMemory } from 'rate-limiter-flexible'
import type { RateLimiterAbstract, RateLimiterRes } from 'rate-limiter-flexible'

// Rate limiting via rate-limiter-flexible. In-memory store (single-instance);
// swap RateLimiterMemory -> RateLimiterRedis at horizontal scale — same API, so
// this guard and every call site stay identical. Node-only (server actions).

export async function withRateLimit<T>(
  limiter: RateLimiterAbstract,
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    await limiter.consume(key, 1)
  } catch (rejection) {
    // A real store failure rejects with an Error — propagate it. A rate-limit
    // hit rejects with a RateLimiterRes (carries msBeforeNext) — convert to a
    // clear error.
    if (rejection instanceof Error) throw rejection
    const ms = (rejection as RateLimiterRes).msBeforeNext ?? 0
    throw new Error(
      `Rate limit exceeded. Retry in ${Math.ceil(ms / 1000)}s`,
    )
  }
  return fn()
}

// Order writes: 30 per minute per user.
export const orderWriteLimiter = new RateLimiterMemory({
  points: 30,
  duration: 60,
})
