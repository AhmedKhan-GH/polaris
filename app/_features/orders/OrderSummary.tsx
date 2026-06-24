import { orderTotalCents } from './pricing';

/**
 * Order detail footer: the line-item count and the order total (sum of line
 * totals). Pure, read-only presentation over the priced lines — the arithmetic
 * lives in `pricing.ts` so the page never does ad-hoc money math. A server
 * component (no interactivity); the detail page renders it under the line table.
 */
export type OrderSummaryLine = {
  listPriceCents: number;
  overridePriceCents: number | null;
  quantity: number;
};

const usd = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  );

export function OrderSummary({ lines }: { lines: OrderSummaryLine[] }) {
  const count = lines.length;
  return (
    <div
      data-testid="order-summary"
      className="flex justify-end gap-6 border-t border-zinc-200 pt-3 text-sm"
    >
      <span data-testid="order-line-count" className="text-zinc-500">
        {count} {count === 1 ? 'line item' : 'line items'}
      </span>
      <span data-testid="order-total" className="font-medium">
        Total {usd(orderTotalCents(lines))}
      </span>
    </div>
  );
}
