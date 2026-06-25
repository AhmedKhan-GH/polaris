import { describe, expect, it } from 'vitest';

import { groupOrdersByStatus } from './grouping';
import { ORDER_STATUSES, type OrderStatus } from './transitions';

const order = (id: string, status: OrderStatus) => ({
  id,
  orderNumber: 100000,
  createdBy: '11111111-1111-4111-8111-111111111111',
  status,
  statusUpdatedAt: new Date(0),
  createdAt: new Date(0),
});

describe('groupOrdersByStatus', () => {
  it('returns an empty list for every status when there are no orders', () => {
    const grouped = groupOrdersByStatus([]);
    expect(Object.keys(grouped)).toEqual([...ORDER_STATUSES]);
    for (const s of ORDER_STATUSES) expect(grouped[s]).toEqual([]);
  });

  it('buckets each order under its own status', () => {
    const a = order('a', 'draft');
    const b = order('b', 'submitted');
    const c = order('c', 'draft');
    const grouped = groupOrdersByStatus([a, b, c]);
    expect(grouped.draft).toEqual([a, c]);
    expect(grouped.submitted).toEqual([b]);
    expect(grouped.processing).toEqual([]);
  });

  it('preserves the input order within a bucket (callers pass newest-first)', () => {
    const a = order('a', 'draft');
    const b = order('b', 'draft');
    expect(groupOrdersByStatus([b, a]).draft).toEqual([b, a]);
  });

  it('keys come out in canonical ORDER_STATUSES order (stable columns)', () => {
    expect(Object.keys(groupOrdersByStatus([]))).toEqual([
      'draft',
      'submitted',
      'processing',
      'completed',
      'cancelled',
    ]);
  });
});
