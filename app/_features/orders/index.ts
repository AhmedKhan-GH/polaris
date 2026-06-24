/**
 * Orders dev API (Iron Rule 8, ADR-0005) — the ONLY surface outsiders may
 * import; the boundary law (rule D) fails the build on anything deeper. Exactly
 * what the route pages consume, one deliberate export per line.
 *
 * NOT exported on purpose: the manifests `schema`/`permissions`/`nav` (the
 * registry's seam, rule C — never re-export manifests through the index).
 */
export {
  createOrder,
  getOrders,
  getOrder,
  getOrderLines,
  addLine,
  updateLine,
  removeLine,
  transitionOrder,
  type OrderRow,
  type LineRow,
} from './actions';
export { getAllowedTransitions, type OrderStatus } from './transitions';
export { effectivePriceCents, lineTotalCents } from './pricing';
export { LineItemRow, type LineItemRowData } from './LineItemRow';
export { ProductCombobox, type ProductOption } from './ProductCombobox';
export { OrderSummary, type OrderSummaryLine } from './OrderSummary';
