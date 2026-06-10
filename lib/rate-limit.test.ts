// @vitest-environment node
//
// Rate-limiter factory contract (lib/rate-limit). Runs in the `node`
// environment because rate-limiter-flexible is a Node-side library.
//
// These cycles exercise a REAL `RateLimiterMemory` produced by the factory —
// no mocks for the limiter itself. The only test doubles are a `vi.fn()`
// standing in for the wrapped work `fn` (so we can assert it did/didn't run),
// and, for the store-failure cycle, a hand-rolled stub limiter whose
// `consume` rejects with a real `Error` (simulating e.g. Redis down).

import { describe, expect, it, vi } from 'vitest';
import type { RateLimiterAbstract } from 'rate-limiter-flexible';

import { createRateLimiter, withRateLimit } from './rate-limit';

describe('lib/rate-limit', () => {
  it('runs fn and returns its value when under the limit', async () => {
    const limiter = createRateLimiter({ points: 2, duration: 60 });
    const fn = vi.fn().mockResolvedValue('ok');

    await expect(withRateLimit(limiter, 'k', fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('allows exactly `points` calls, then rejects with a retry message', async () => {
    const limiter = createRateLimiter({ points: 2, duration: 60 });
    const fn = vi.fn().mockResolvedValue('ok');

    await withRateLimit(limiter, 'k', fn);
    await withRateLimit(limiter, 'k', fn);
    expect(fn).toHaveBeenCalledTimes(2);

    await expect(withRateLimit(limiter, 'k', fn)).rejects.toThrow(
      /rate limit exceeded/i,
    );
    expect(fn).toHaveBeenCalledTimes(2); // fn NOT invoked on the rejected call
  });

  it('rejection message carries a "retry in Ns" hint', async () => {
    const limiter = createRateLimiter({ points: 1, duration: 60 });
    const fn = vi.fn().mockResolvedValue('ok');

    await withRateLimit(limiter, 'k', fn);
    await expect(withRateLimit(limiter, 'k', fn)).rejects.toThrow(/retry in \d+s/i);
  });

  it('isolates budgets per key', async () => {
    const limiter = createRateLimiter({ points: 1, duration: 60 });
    const fn = vi.fn().mockResolvedValue('ok');

    // Exhaust key 'a'.
    await withRateLimit(limiter, 'a', fn);
    await expect(withRateLimit(limiter, 'a', fn)).rejects.toThrow(
      /rate limit exceeded/i,
    );

    // 'b' has its own untouched budget.
    await expect(withRateLimit(limiter, 'b', fn)).resolves.toBe('ok');

    // 'a' is still blocked — consuming 'b' did not refill it.
    await expect(withRateLimit(limiter, 'a', fn)).rejects.toThrow(
      /rate limit exceeded/i,
    );
  });

  it('passes a real store failure through unchanged (not a throttle)', async () => {
    // A store outage (e.g. Redis down once we swap stores) surfaces as a real
    // Error from `consume`, distinct from the RateLimiterRes thrown on throttle.
    const limiter = {
      consume: vi.fn().mockRejectedValue(new Error('redis down')),
    } as unknown as RateLimiterAbstract;
    const fn = vi.fn().mockResolvedValue('ok');

    await expect(withRateLimit(limiter, 'k', fn)).rejects.toThrow('redis down');
    expect(fn).not.toHaveBeenCalled();
  });
});
