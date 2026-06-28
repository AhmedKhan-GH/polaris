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
  // Baseline for the now-required vars so each cycle exercises only the variable
  // under test. Cases that probe a specific var override or delete it.
  process.env.DATABASE_URL = 'postgres://x';
  process.env.GOOGLE_MAPS_SERVER_KEY = 'server-key';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
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

  it('exposes the Google Maps server key only through server env', async () => {
    process.env.GOOGLE_MAPS_SERVER_KEY = 'server-key';
    const { env } = await import('./index');
    expect(env.GOOGLE_MAPS_SERVER_KEY).toBe('server-key');
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

  it('fails closed when GOOGLE_MAPS_SERVER_KEY is missing', async () => {
    delete process.env.GOOGLE_MAPS_SERVER_KEY;
    await expect(import('./index')).rejects.toThrow();
  });

  it('fails closed on a malformed NEXT_PUBLIC_SUPABASE_URL', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-url';
    await expect(import('./index')).rejects.toThrow();
  });

  it('exposes the Supabase URL and anon key', async () => {
    const { env } = await import('./index');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321');
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('anon-key');
  });
});
