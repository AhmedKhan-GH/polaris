// @vitest-environment node
//
// The order state machine — a pure function of (roles, status). Ownership is NOT
// modeled here (RLS + the action enforce "is this caller's order"); this decides
// only which status moves a role may drive from a given state, and drives both
// the UI affordances and the action's legality check.

import { describe, expect, it } from 'vitest';

import { canTransition, getAllowedTransitions } from '@/app/_features/orders/transitions';

describe('orders state machine', () => {
  describe('getAllowedTransitions — owner/admin (the back office, any order)', () => {
    it('draft → submitted | cancelled', () => {
      expect(getAllowedTransitions(['admin'], 'draft').sort()).toEqual([
        'cancelled',
        'submitted',
      ]);
      expect(getAllowedTransitions(['owner'], 'draft').sort()).toEqual([
        'cancelled',
        'submitted',
      ]);
    });

    it('submitted → draft (recall) | processing | cancelled', () => {
      expect(getAllowedTransitions(['admin'], 'submitted').sort()).toEqual([
        'cancelled',
        'draft',
        'processing',
      ]);
    });

    it('processing → completed | cancelled', () => {
      expect(getAllowedTransitions(['admin'], 'processing').sort()).toEqual([
        'cancelled',
        'completed',
      ]);
    });

    it('terminal states have no outgoing transitions', () => {
      expect(getAllowedTransitions(['owner'], 'completed')).toEqual([]);
      expect(getAllowedTransitions(['owner'], 'cancelled')).toEqual([]);
    });
  });

  describe('getAllowedTransitions — member (the contractor, own order)', () => {
    it('draft → submitted | cancelled', () => {
      expect(getAllowedTransitions(['member'], 'draft').sort()).toEqual([
        'cancelled',
        'submitted',
      ]);
    });

    it('submitted → draft (recall) | cancelled — but NOT processing', () => {
      expect(getAllowedTransitions(['member'], 'submitted').sort()).toEqual([
        'cancelled',
        'draft',
      ]);
    });

    it('cannot act on a processing order (the office owns it now)', () => {
      expect(getAllowedTransitions(['member'], 'processing')).toEqual([]);
    });
  });

  it('no roles → no transitions (fail closed)', () => {
    expect(getAllowedTransitions([], 'draft')).toEqual([]);
  });

  describe('canTransition', () => {
    it('a member can submit and recall their own order', () => {
      expect(canTransition(['member'], 'draft', 'submitted')).toBe(true);
      expect(canTransition(['member'], 'submitted', 'draft')).toBe(true);
    });

    it('a member cannot process', () => {
      expect(canTransition(['member'], 'submitted', 'processing')).toBe(false);
    });

    it('an admin can process and complete', () => {
      expect(canTransition(['admin'], 'submitted', 'processing')).toBe(true);
      expect(canTransition(['admin'], 'processing', 'completed')).toBe(true);
    });

    it('rejects an illegal jump (draft → completed)', () => {
      expect(canTransition(['admin'], 'draft', 'completed')).toBe(false);
    });
  });
});
