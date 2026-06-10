// @vitest-environment node
//
// Validated environment contract (lib/env). These tests run in the `node`
// environment (not jsdom) because t3-env's validation reads `process.env` and
// must execute in a Node context. Each cycle snapshots and restores
// `process.env`, and resets the module registry so `./index` re-evaluates with
// the env in force for that case.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIG = { ...process.env };

afterEach(() => {
  process.env = { ...ORIG };
});

beforeEach(() => {
  vi.resetModules();
});

describe('lib/env', () => {
  it('imports cleanly and leaves LOG_LEVEL undefined when unset', async () => {
    delete process.env.LOG_LEVEL;
    const { env } = await import('./index');
    expect(env.LOG_LEVEL).toBeUndefined();
  });

  it('exposes a valid LOG_LEVEL value', async () => {
    process.env.LOG_LEVEL = 'debug';
    const { env } = await import('./index');
    expect(env.LOG_LEVEL).toBe('debug');
  });

  it('fails closed on an invalid LOG_LEVEL', async () => {
    process.env.LOG_LEVEL = 'banana';
    await expect(import('./index')).rejects.toThrow();
  });

  it('treats an empty LOG_LEVEL as undefined', async () => {
    process.env.LOG_LEVEL = '';
    const { env } = await import('./index');
    expect(env.LOG_LEVEL).toBeUndefined();
  });

  it('bypasses validation when SKIP_ENV_VALIDATION is set', async () => {
    process.env.SKIP_ENV_VALIDATION = '1';
    process.env.LOG_LEVEL = 'banana';
    await expect(import('./index')).resolves.toBeDefined();
  });
});
