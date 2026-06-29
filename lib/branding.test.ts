// @vitest-environment node
//
// The written-name forms are static brand copy the page renders verbatim. This pins the
// USER-CONFIRMED set, in display order: the legal name (spaced + capitalized, only with
// LLC), the domain (zeefoods.com — lowercase), then casual (ZeeFoods — capital F). The
// email form is gone.
//
// Honest caveat: this is a change-detector. It binds nothing across systems and tests no
// logic — it just restates the literals in branding.ts, so it only re-fails when someone
// edits the copy on purpose (then you update both). Kept per CLAUDE.md's TDD rule.

import { describe, expect, it } from 'vitest';

import { branding } from './branding';

describe('branding naming forms', () => {
  it('records the legal name and the written-name forms (no email line)', () => {
    expect(branding.naming.legalName).toBe('Zee Foods, LLC.');
    expect(branding.naming.forms.map((f) => f.name)).toEqual([
      'Zee Foods, LLC.',
      'zeefoods.com',
      'ZeeFoods',
    ]);
    for (const f of branding.naming.forms) {
      expect(f.use.length).toBeGreaterThan(0);
    }
  });
});
