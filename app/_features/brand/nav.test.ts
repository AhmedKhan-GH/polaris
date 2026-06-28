// @vitest-environment node
//
// brand nav manifest, proven through the REAL composition root (lib/registry/nav)
// — it must be WIRED in, not merely defined (an unregistered manifest renders no
// link). Ungated: the canonical brand reference is for everyone signed in.

import { describe, expect, it } from 'vitest';

import { navItems } from '@/lib/registry/nav';

import { brandNav } from './nav';

describe('app/_features/brand nav', () => {
  it('declares an ungated Brand entry pointing at /brand', () => {
    expect(brandNav).toEqual({ label: 'Brand', href: '/brand' });
    expect(brandNav.permission).toBeUndefined();
  });

  it('is registered in the nav composition root', () => {
    expect(navItems).toContainEqual(brandNav);
  });
});
