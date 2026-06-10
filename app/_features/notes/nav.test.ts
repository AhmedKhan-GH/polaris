// @vitest-environment node
//
// notes nav manifest, proven through the REAL composition root
// (lib/registry/nav). Like the abilities suites, this asserts the entry is
// actually WIRED into the registry, not merely that the manifest object exists —
// a manifest no one registers renders no link. Notes carries no `permission`, so
// it is an all-authed-users entry: the dashboard always shows it.

import { describe, expect, it } from 'vitest';

import { navItems } from '@/lib/registry/nav';

import { notesNav } from './nav';

describe('app/_features/notes nav', () => {
  it('declares an ungated Notes entry pointing at /notes', () => {
    expect(notesNav).toEqual({ label: 'Notes', href: '/notes' });
    expect(notesNav.permission).toBeUndefined();
  });

  it('is registered in the nav composition root', () => {
    expect(navItems).toContainEqual(notesNav);
  });
});
