// @vitest-environment node
//
// withPermission guard contract (lib/permissions/guard) — Domain Charter D4.
// Runs in the `node` environment because the unit is server-side: it resolves
// the request's session and gates a server action behind a CASL ability.
//
// `@/lib/auth/session` and `@/lib/logger` are mocked via `vi.hoisted` so the
// cycles assert the guard's wiring (session resolution, fail-closed ordering,
// denial logging) WITHOUT a real Supabase project or request context.
//
// Ability behaviour is deliberately NOT mocked at `@/lib/permissions/ability`:
// mocking the ability would only echo a stub back. Instead we mock the REGISTRY
// (`@/lib/registry/abilities`) with a single contributor that grants `read
// Thing` ONLY when `identity.roles` includes `'reader'`, then dynamically import
// the guard so its default `buildAbility` composes the mocked registry. This
// proves the guard→ability→registry seam end-to-end, not a mock's reflection.
// The contributor is a `vi.fn` spy so a cycle can assert it was NEVER invoked
// (e.g. when the guard fails closed BEFORE any ability evaluation).

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Identity } from '@/lib/permissions/ability';

const fake = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  warn: vi.fn(),
  // Grants `read Thing` only for the 'reader' role. A spy so cycles can assert
  // it was (or was never) consulted.
  contributor: vi.fn(
    (can: (action: string, subject: string) => void, identity: Identity) => {
      if (identity.roles.includes('reader')) can('read', 'Thing');
    },
  ),
}));

vi.mock('@/lib/auth/session', () => ({ getSessionUser: fake.getSessionUser }));
vi.mock('@/lib/logger', () => ({ logger: { warn: fake.warn } }));
vi.mock('@/lib/registry/abilities', () => ({
  abilityContributors: [fake.contributor],
}));

// Dynamic import: the registry mock above must be installed before the guard's
// transitive `buildAbility` default parameter binds to it.
const { withPermission } = await import('./guard');

beforeEach(() => {
  fake.getSessionUser.mockReset();
  fake.warn.mockReset();
  fake.contributor.mockClear();
});

describe('lib/permissions withPermission — granted', () => {
  it('resolves the session once and runs fn with { userId, roles } when allowed', async () => {
    fake.getSessionUser.mockResolvedValue({
      userId: 'u1',
      email: 'a@b.com',
      roles: ['reader'],
    });
    const fn = vi.fn(async () => 'result');

    const result = await withPermission('read', 'Thing', fn);

    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ userId: 'u1', roles: ['reader'] });
    expect(fake.warn).not.toHaveBeenCalled();
  });
});

describe('lib/permissions withPermission — denied (CASL)', () => {
  it('throws "Not authorized", skips fn, and warns once with the denial payload', async () => {
    fake.getSessionUser.mockResolvedValue({
      userId: 'u1',
      email: 'a@b.com',
      roles: ['other'],
    });
    const fn = vi.fn(async () => 'result');

    await expect(withPermission('read', 'Thing', fn)).rejects.toThrow(
      'Not authorized',
    );

    expect(fn).not.toHaveBeenCalled();
    expect(fake.warn).toHaveBeenCalledTimes(1);
    expect(fake.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'a@b.com',
        userId: 'u1',
        roles: ['other'],
        action: 'read',
        subject: 'Thing',
      }),
      expect.any(String),
    );
  });
});

describe('lib/permissions withPermission — no session (fail closed)', () => {
  it('throws "Not authenticated", skips fn, and warns once (no-session variant)', async () => {
    fake.getSessionUser.mockResolvedValue(null);
    const fn = vi.fn(async () => 'result');

    await expect(withPermission('read', 'Thing', fn)).rejects.toThrow(
      'Not authenticated',
    );

    expect(fn).not.toHaveBeenCalled();
    expect(fake.warn).toHaveBeenCalledTimes(1);
    expect(fake.warn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'read', subject: 'Thing' }),
      expect.any(String),
    );
  });

  it('fails closed BEFORE ability evaluation when userId is missing (registry never consulted)', async () => {
    // Session object present but with no userId — a malformed/half-resolved
    // identity. The guard must treat this as "no authenticated identity" and
    // fail closed WITHOUT ever building/evaluating the ability. Shaped loosely
    // and cast: `userId` is contractually a string, but we feed the degenerate
    // runtime case the type system forbids. `roles: ['reader']` would otherwise
    // satisfy the registry contributor, so if the contributor IS consulted the
    // call would wrongly succeed — proving the ordering matters.
    fake.getSessionUser.mockResolvedValue({
      email: 'a@b.com',
      roles: ['reader'],
    } as unknown as Awaited<ReturnType<typeof fake.getSessionUser>>);
    const fn = vi.fn(async () => 'result');

    await expect(withPermission('read', 'Thing', fn)).rejects.toThrow(
      'Not authenticated',
    );

    expect(fn).not.toHaveBeenCalled();
    expect(fake.contributor).not.toHaveBeenCalled();
  });
});

describe('lib/permissions withPermission — undefined roles normalize to []', () => {
  it('treats missing roles as the empty set and denies cleanly (no TypeError)', async () => {
    // A valid identity (has userId) but with no roles field — cast past the
    // contract, which promises `string[]`. The guard must normalize this to the
    // empty set so a role-gated rule simply denies. If `roles` reached the
    // contributor as `undefined`, `identity.roles.includes(...)` would throw a
    // TypeError instead of the contractual 'Not authorized'.
    fake.getSessionUser.mockResolvedValue({
      userId: 'u1',
      email: 'a@b.com',
    } as unknown as Awaited<ReturnType<typeof fake.getSessionUser>>);
    const fn = vi.fn(async () => 'result');

    await expect(withPermission('read', 'Thing', fn)).rejects.toThrow(
      'Not authorized',
    );

    expect(fn).not.toHaveBeenCalled();
    expect(fake.warn).toHaveBeenCalledTimes(1);
    expect(fake.warn).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', roles: [], action: 'read', subject: 'Thing' }),
      'authorization denied',
    );
  });
});
