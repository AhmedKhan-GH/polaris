import { describe, expect, it } from 'vitest';

import { filterOrders } from './filtering';
import type { OrderStatus } from './transitions';

const order = (id: string, status: OrderStatus, createdAt: string) => ({
  id,
  orderNumber: 100000,
  createdBy: '11111111-1111-4111-8111-111111111111',
  status,
  statusUpdatedAt: new Date(createdAt),
  createdAt: new Date(createdAt),
});

const a = order('a', 'draft', '2026-06-01T10:00:00Z');
const b = order('b', 'submitted', '2026-06-10T10:00:00Z');
const c = order('c', 'submitted', '2026-06-20T10:00:00Z');
const all = [a, b, c];

describe('filterOrders', () => {
  it('returns every order when no filters are set', () => {
    expect(filterOrders(all, {})).toEqual(all);
  });

  it('filters by status', () => {
    expect(filterOrders(all, { status: 'submitted' })).toEqual([b, c]);
  });

  it('filters by a from-date (inclusive)', () => {
    expect(filterOrders(all, { from: '2026-06-10' })).toEqual([b, c]);
  });

  it('filters by a to-date, inclusive of that whole day', () => {
    expect(filterOrders(all, { to: '2026-06-10' })).toEqual([a, b]);
  });

  it('combines status and date range', () => {
    expect(filterOrders(all, { status: 'submitted', from: '2026-06-15' })).toEqual([c]);
  });

  it('treats blank filter values as no filter', () => {
    expect(filterOrders(all, { status: '', from: '', to: '' })).toEqual(all);
  });
});
