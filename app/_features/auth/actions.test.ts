// @vitest-environment node
//
// Sign-in / sign-out server actions (app/_features/auth/actions).
//
// Runs in the `node` environment because these are server actions: they build
// the request-scoped Supabase client, write the audit fact, and redirect. The
// four collaborators are mocked via `vi.hoisted` so the cycles assert wiring —
// credential coercion, Zod validation, the GoTrue call, the audit write, the
// log lines, and the redirect — WITHOUT a real Supabase project, database, or
// Next request context.
//
// `next/navigation`'s `redirect` is a plain `vi.fn` here (it does NOT throw),
// so assertions after a redirect still observe the call. `fd(email, password)`
// builds the FormData a `<form action>` submission would hand the action.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  getServerSupabase: vi.fn(),
  recordSignIn: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: fake.getServerSupabase,
}));
vi.mock('@/lib/audit/record-sign-in', () => ({
  recordSignIn: fake.recordSignIn,
}));
vi.mock('@/lib/logger', () => ({
  logger: { warn: fake.warn, info: fake.info },
}));
vi.mock('next/navigation', () => ({ redirect: fake.redirect }));

import { signInAction, signOutAction } from './actions';

/** Build the FormData a `<form action>` submit would pass to the action. */
function fd(email: string, password: string): FormData {
  const form = new FormData();
  form.set('email', email);
  form.set('password', password);
  return form;
}

/** A Supabase stub whose `signInWithPassword` resolves to `result`. */
function supabaseSignInResolves(result: unknown) {
  return {
    auth: { signInWithPassword: vi.fn(async () => result) },
  };
}

beforeEach(() => {
  fake.getServerSupabase.mockReset();
  fake.recordSignIn.mockReset();
  fake.warn.mockReset();
  fake.info.mockReset();
  fake.redirect.mockReset();
});

describe('app/_features/auth signInAction', () => {
  it('on valid creds: signs in, records the audit fact, and redirects to /dashboard', async () => {
    const client = supabaseSignInResolves({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });
    fake.getServerSupabase.mockResolvedValue(client);

    await signInAction({}, fd('a@b.com', 'pw'));

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pw',
    });
    expect(fake.recordSignIn).toHaveBeenCalledWith({
      userId: 'u1',
      email: 'a@b.com',
    });
    expect(fake.redirect).toHaveBeenCalledWith('/dashboard');
    expect(fake.warn).not.toHaveBeenCalled();
  });

  it('on a GoTrue error: returns the message, warns once, does not record or redirect', async () => {
    const client = supabaseSignInResolves({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });
    fake.getServerSupabase.mockResolvedValue(client);

    await expect(signInAction({}, fd('a@b.com', 'pw'))).resolves.toEqual({
      error: 'Invalid login credentials',
    });
    expect(fake.redirect).not.toHaveBeenCalled();
    expect(fake.recordSignIn).not.toHaveBeenCalled();
    expect(fake.warn).toHaveBeenCalledTimes(1);
  });

  it('on invalid input: returns an error and NEVER calls Supabase', async () => {
    const result = await signInAction({}, fd('not-an-email', 'pw'));

    expect(result.error).toBeTruthy();
    expect(fake.getServerSupabase).not.toHaveBeenCalled();
  });
});

describe('app/_features/auth signOutAction', () => {
  it('signs out, then redirects to the landing page', async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    fake.getServerSupabase.mockResolvedValue({ auth: { signOut } });

    await signOutAction();

    expect(signOut).toHaveBeenCalled();
    expect(fake.redirect).toHaveBeenCalledWith('/');
  });
});
