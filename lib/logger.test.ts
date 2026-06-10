// @vitest-environment node
//
// Logger contract (lib/logger). Runs in the `node` environment (not jsdom)
// because pino is a Node-side library. Each cycle resets the module registry
// and re-mocks `@/lib/env` so the dynamic `import('./logger')` sees the
// LOG_LEVEL we intend for that case.
//
// Transport noise: pino-pretty runs in a worker thread that writes to stdout.
// To keep test output pristine we force `NODE_ENV=production` for every cycle,
// which exercises the no-transport (raw-JSON) path. The contract under test —
// level resolution and "is this a real pino instance" — is fully observable on
// that path, so we never spin up the pretty-print worker.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('@/lib/env');
});

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', 'production');
});

describe('lib/logger', () => {
  it('defaults to "info" when LOG_LEVEL is unset', async () => {
    vi.doMock('@/lib/env', () => ({ env: { LOG_LEVEL: undefined } }));
    const { logger } = await import('./logger');
    expect(logger.level).toBe('info');
  });

  it('honors LOG_LEVEL from the environment', async () => {
    vi.doMock('@/lib/env', () => ({ env: { LOG_LEVEL: 'debug' } }));
    const { logger } = await import('./logger');
    expect(logger.level).toBe('debug');
  });

  it('is a real pino instance (exposes child())', async () => {
    vi.doMock('@/lib/env', () => ({ env: { LOG_LEVEL: undefined } }));
    const { logger } = await import('./logger');
    expect(typeof logger.child).toBe('function');
  });
});
