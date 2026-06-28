/**
 * Per-line price derivation for orders.
 *
 * A line freezes a `listPriceCents` snapshot at add time (so a later catalog
 * price change never rewrites a placed order's totals). `overridePriceCents` is
 * an optional per-line price the user typed — a deliberate off-list override
 * that lives ALONGSIDE the snapshot rather than overwriting it, so discounting
 * stays auditable ("was $list, now $override"). The EFFECTIVE price billed is
 * the override when present, else the list price.
 *
 * Pure functions — the page and the editable row both compute totals through
 * here rather than doing ad-hoc math, and neither mutates the snapshot.
 */

type LinePrice = {
  listPriceCents: number;
  overridePriceCents: number | null;
};

/** The price this line is billed at: the override when set (incl. 0), else list. */
export function effectivePriceCents(line: LinePrice): number {
  return line.overridePriceCents ?? line.listPriceCents;
}

/** The line's total: effective price × quantity. */
export function lineTotalCents(line: LinePrice & { quantity: number }): number {
  return effectivePriceCents(line) * line.quantity;
}

/** The order's total: the sum of every line total (0 for an empty order). */
export function orderTotalCents(
  lines: Array<LinePrice & { quantity: number }>,
): number {
  return lines.reduce((sum, line) => sum + lineTotalCents(line), 0);
}
