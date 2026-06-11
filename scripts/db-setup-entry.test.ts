import { describe, expect, it } from 'vitest';

import { isDbSetupCliEntry } from './db-setup';

/**
 * CLI-entry detection for scripts/db-setup.ts. The module is BOTH a library
 * (imported by the e2e global-setup and the integration suites — running the
 * CLI there would wipe state mid-run) and an executable (`npm run db:setup`).
 * Detection is argv-based, so it must hold across runners and platforms —
 * the Windows case is the regression that motivated this suite: a
 * backslashed `C:\…\scripts\db-setup.ts` failed the forward-slash match and
 * db:setup exited 0 having provisioned NOTHING.
 */
describe('isDbSetupCliEntry', () => {
  it('matches a POSIX argv[1] (npm run db:setup on macOS/Linux)', () => {
    expect(
      isDbSetupCliEntry('/Users/dev/polaris/scripts/db-setup.ts'),
    ).toBe(true);
  });

  it('matches a Windows backslashed argv[1]', () => {
    expect(
      isDbSetupCliEntry(
        'C:\\Users\\penut\\Desktop\\polaris\\scripts\\db-setup.ts',
      ),
    ).toBe(true);
  });

  it('rejects the vitest binary (suite import must not run the CLI)', () => {
    expect(
      isDbSetupCliEntry('/Users/dev/polaris/node_modules/.bin/vitest'),
    ).toBe(false);
  });

  it('rejects the playwright cli (e2e global-setup import must not run it)', () => {
    expect(
      isDbSetupCliEntry(
        '/Users/dev/polaris/node_modules/playwright/cli.js',
      ),
    ).toBe(false);
  });

  it('rejects an absent argv[1]', () => {
    expect(isDbSetupCliEntry(undefined)).toBe(false);
  });
});
