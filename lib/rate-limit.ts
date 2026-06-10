import { RateLimiterMemory, type RateLimiterAbstract } from 'rate-limiter-flexible';

/**
 * Rate-limiter FACTORY (Charter D6). This module manufactures limiters and
 * wraps work with them; it does NOT own any concrete limiter instance.
 *
 * D6 inverts the predecessor's mistake: that codebase welded a singleton
 * `orderWriteLimiter` into the abuse module, so the foundation knew about the
 * orders feature and every consumer shared one global budget. Here the
 * foundation stays feature-blind — each feature constructs and owns its own
 * limiter in its own folder (with its own points/duration), and merely passes
 * it to `withRateLimit`. Do not add a named limiter instance to this file.
 *
 * Store: in-memory now (`RateLimiterMemory`). At scale, swap the factory's
 * store for the Redis variant — the `RateLimiterAbstract` API is identical, so
 * `withRateLimit` and every call site are untouched.
 */
export function createRateLimiter(opts: {
  points: number;
  duration: number;
}): RateLimiterMemory {
  return new RateLimiterMemory({ points: opts.points, duration: opts.duration });
}

/**
 * Consume one point for `key`, then run `fn` only if the budget allowed it.
 *
 * `consume` rejects in two distinct ways, and they must be told apart:
 *   - with a `RateLimiterRes` (NOT an Error) when the caller is throttled —
 *     we translate that into a friendly "retry in Ns" Error;
 *   - with a real `Error` when the underlying store itself failed (e.g. Redis
 *     down once we swap stores) — that is an operational fault, not a throttle,
 *     so we rethrow it unchanged rather than masking it as a 429.
 *
 * The discriminator is `instanceof Error`: a `RateLimiterRes` is a plain
 * result object and is never an Error.
 */
export async function withRateLimit<T>(
  limiter: RateLimiterAbstract,
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    await limiter.consume(key, 1);
  } catch (rejection) {
    if (rejection instanceof Error) throw rejection;
    const { msBeforeNext } = rejection as { msBeforeNext: number };
    throw new Error(`Rate limit exceeded. Retry in ${Math.ceil(msBeforeNext / 1000)}s`);
  }
  return fn();
}
