import { describe, expect, it } from 'vitest';

import { isSeedDevCliEntry } from './seed-dev';

/**
 * CLI-entry detection for scripts/seed-dev.ts. Like db-setup, this module is BOTH
 * a library (the e2e global-setup imports `seedDemoUsers` from it) and an
 * executable (`npm run db:seed-dev`). Running the CLI on import would seed the
 * full dummy catalog mid-E2E and break products.spec's exact-count assertions,
 * so detection is argv-based and must hold across runners and platforms.
 */
describe('isSeedDevCliEntry', () => {
  it('matches a POSIX argv[1] (npm run db:seed-dev on macOS/Linux)', () => {
    expect(isSeedDevCliEntry('/Users/dev/polaris/scripts/seed-dev.ts')).toBe(true);
  });

  it('matches a Windows backslashed argv[1]', () => {
    expect(
      isSeedDevCliEntry('C:\\Users\\dev\\polaris\\scripts\\seed-dev.ts'),
    ).toBe(true);
  });

  it('rejects the vitest binary (suite import must not run the CLI)', () => {
    expect(isSeedDevCliEntry('/Users/dev/polaris/node_modules/.bin/vitest')).toBe(false);
  });

  it('rejects the playwright cli (e2e global-setup import must not run it)', () => {
    expect(
      isSeedDevCliEntry('/Users/dev/polaris/node_modules/playwright/cli.js'),
    ).toBe(false);
  });

  it('rejects an absent argv[1]', () => {
    expect(isSeedDevCliEntry(undefined)).toBe(false);
  });
});
