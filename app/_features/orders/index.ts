/**
 * Orders dev API (Iron Rule 8, ADR-0005) — the ONLY surface outsiders may
 * import; the boundary law (rule D) fails the build on anything deeper. Exactly
 * what the route page consumes, one deliberate export per line.
 *
 * NOT exported on purpose: the manifests `schema`/`permissions`/`nav` (the
 * registry's seam, rule C — never re-export manifests through the index).
 */
export {
  createOrder,
  getOrders,
  getOrder,
  getOrderLineItems,
  addLineItem,
  updateLineItem,
  removeLineItem,
  type OrderRow,
  type LineItemRow,
} from './actions';
