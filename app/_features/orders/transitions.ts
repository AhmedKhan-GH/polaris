/**
 * The order lifecycle state machine (single source of truth for legal moves).
 *
 * `VALID_TRANSITIONS` is the role-agnostic graph; `getAllowedTransitions` layers
 * the role gate on top. Ownership is deliberately NOT modeled here — the RLS and
 * the guarded action enforce "is this the caller's order"; this module answers
 * only "which status may this role move to from here", and feeds both the UI
 * affordances and the action's legality check.
 */
export const ORDER_STATUSES = [
  'draft',
  'submitted',
  'processing',
  'completed',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const VALID_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['draft', 'processing', 'cancelled'], // draft = recall
  processing: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// Targets only the back office (`admin`/`owner`) may drive. A `member` confirms
// (submit), recalls, or cancels their own order, but never pushes it through
// fulfillment.
const PRIVILEGED_TARGETS: ReadonlySet<OrderStatus> = new Set([
  'processing',
  'completed',
]);

/**
 * The statuses `roles` may move an order to from `status`. `owner`/`admin` get
 * the full graph; a `member` gets it minus the privileged targets, and nothing
 * once the order is `processing` (the office owns it then). Unknown/empty roles
 * get nothing — fail closed.
 */
export function getAllowedTransitions(
  roles: readonly string[],
  status: OrderStatus,
): OrderStatus[] {
  const all = VALID_TRANSITIONS[status] ?? [];
  if (roles.includes('owner') || roles.includes('admin')) return [...all];
  if (roles.includes('member')) {
    if (status === 'processing') return [];
    return all.filter((target) => !PRIVILEGED_TARGETS.has(target));
  }
  return [];
}

/** Whether `roles` may move an order from `from` to `to`. */
export function canTransition(
  roles: readonly string[],
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return getAllowedTransitions(roles, from).includes(to);
}
