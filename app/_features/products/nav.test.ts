// @vitest-environment node
//
// products nav manifest, proven through the REAL composition root
// (lib/registry/nav). Asserts the entry is actually WIRED into the registry, not
// merely that the manifest object exists — a manifest no one registers renders
// no link. Products carries no `permission`: read is unconditional, so every
// authed user sees the link (the page itself gates the owner-only controls).

import { describe, expect, it } from 'vitest';

import { navItems } from '@/lib/registry/nav';

import { productsNav } from './nav';

describe('app/_features/products nav', () => {
  it('declares an ungated Products entry pointing at /products', () => {
    expect(productsNav).toEqual({ label: 'Products', href: '/products' });
    expect(productsNav.permission).toBeUndefined();
  });

  it('is registered in the nav composition root', () => {
    expect(navItems).toContainEqual(productsNav);
  });
});
