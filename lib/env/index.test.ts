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
  // Baseline for the now-required server vars so each cycle exercises only the
  // variable under test. Cases that probe a specific var override or delete it.
  process.env.DATABASE_URL = 'postgres://x';
});

describe('lib/env', () => {
  it('imports cleanly and leaves LOG_LEVEL undefined when unset', async () => {
    delete process.env.LOG_LEVEL;
    const { env } = await import('./index');
    expect(env.LOG_LEVEL).toBeUndefined();
  });

  it('exposes a valid DATABASE_URL value', async () => {
    process.env.DATABASE_URL = 'postgres://x';
    const { env } = await import('./index');
    expect(env.DATABASE_URL).toBe('postgres://x');
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

  it('fails closed when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;
    await expect(import('./index')).rejects.toThrow();
  });
});
