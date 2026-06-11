import { describe, expect, it } from 'vitest';

import { parseCreateUserArgs } from './create-user';

/**
 * Argument parsing for scripts/create-user.ts — the one-shot replacement for
 * the README's manual "curl GoTrue admin API + psql upsert" dance. The flags
 * map to exactly the three inputs that flow into createUser(); role defaults to
 * the least-privilege `member` so an unqualified invocation can't mint an owner
 * by accident.
 */
describe('parseCreateUserArgs', () => {
  it('parses --email, --password and --role', () => {
    expect(
      parseCreateUserArgs([
        '--email',
        'you@example.com',
        '--password',
        'choose-one',
        '--role',
        'owner',
      ]),
    ).toEqual({
      email: 'you@example.com',
      password: 'choose-one',
      role: 'owner',
    });
  });

  it('defaults role to member when --role is omitted (least privilege)', () => {
    expect(
      parseCreateUserArgs(['--email', 'you@example.com', '--password', 'pw']),
    ).toEqual({ email: 'you@example.com', password: 'pw', role: 'member' });
  });

  it('throws a usage error when --email is missing', () => {
    expect(() => parseCreateUserArgs(['--password', 'pw'])).toThrow(/--email/);
  });

  it('throws a usage error when --password is missing', () => {
    expect(() =>
      parseCreateUserArgs(['--email', 'you@example.com']),
    ).toThrow(/--password/);
  });
});
