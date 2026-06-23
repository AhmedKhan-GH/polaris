// @vitest-environment node
//
// Per-line price derivation. A line carries a frozen `listPriceCents` snapshot
// (captured at add time, never edited) and an optional `overridePriceCents` the
// user may type. The EFFECTIVE price the order is billed at is the override when
// present, else the list price; the line total multiplies that by quantity.
// Pure functions — no DB, no override never mutates the snapshot.

import { describe, expect, it } from 'vitest';

import { effectivePriceCents, lineTotalCents } from '@/app/_features/orders/pricing';

describe('effectivePriceCents', () => {
  it('uses the list price when there is no override', () => {
    expect(effectivePriceCents({ listPriceCents: 1000, overridePriceCents: null })).toBe(1000);
  });

  it('uses the override when one is set', () => {
    expect(effectivePriceCents({ listPriceCents: 1000, overridePriceCents: 800 })).toBe(800);
  });

  it('honours a zero override (free line) rather than falling back to list', () => {
    expect(effectivePriceCents({ listPriceCents: 1000, overridePriceCents: 0 })).toBe(0);
  });
});

describe('lineTotalCents', () => {
  it('multiplies the effective price by quantity (no override)', () => {
    expect(lineTotalCents({ listPriceCents: 1000, overridePriceCents: null, quantity: 3 })).toBe(3000);
  });

  it('multiplies the override price by quantity', () => {
    expect(lineTotalCents({ listPriceCents: 1000, overridePriceCents: 800, quantity: 2 })).toBe(1600);
  });
});
