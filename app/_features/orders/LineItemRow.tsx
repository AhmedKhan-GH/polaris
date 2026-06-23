'use client';

import { useTransition } from 'react';

import { removeLine, updateLine } from './actions';
import { effectivePriceCents, lineTotalCents } from './pricing';

/**
 * One editable order-line row. Quantity and unit price are plain inputs that
 * AUTO-SAVE on blur (no Save button) — each as a PARTIAL `updateLine`, so the two
 * cells persist independently. The price box shows the EFFECTIVE price (the
 * override when set, else the frozen list snapshot) in dollars; when an override
 * is active the list price is shown struck-through. The line total sits rightmost.
 *
 * A blur only saves when the value actually changed (no spurious writes against
 * the orders write budget). The route revalidates after each save, re-rendering
 * the total from fresh server data.
 */
export type LineItemRowData = {
  id: string;
  orderId: string;
  lineNumber: number;
  productName: string;
  quantity: number;
  listPriceCents: number;
  overridePriceCents: number | null;
};

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const toDollars = (cents: number) => (cents / 100).toFixed(2);

export function LineItemRow({
  line,
  canEdit,
}: {
  line: LineItemRowData;
  canEdit: boolean;
}) {
  const [, startTransition] = useTransition();
  const hasOverride = line.overridePriceCents !== null;
  const effective = effectivePriceCents(line);
  const total = lineTotalCents(line);

  // The values as first rendered — a blur saves only when the field differs.
  const initialQty = String(line.quantity);
  const initialPrice = toDollars(effective);

  function save(fields: Record<string, string>) {
    const fd = new FormData();
    fd.set('id', line.id);
    fd.set('orderId', line.orderId);
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    startTransition(() => updateLine(fd));
  }

  function onQuantityBlur(e: React.FocusEvent<HTMLInputElement>) {
    const value = e.currentTarget.value.trim();
    if (value === initialQty || value === '') return;
    save({ quantity: value });
  }

  function onPriceBlur(e: React.FocusEvent<HTMLInputElement>) {
    const raw = e.currentTarget.value.trim();
    if (raw === initialPrice) return;
    // Empty clears the override (revert to list); otherwise dollars → cents.
    const overridePriceCents = raw === '' ? '' : String(Math.round(Number(raw) * 100));
    save({ overridePriceCents });
  }

  function onRemove() {
    const fd = new FormData();
    fd.set('id', line.id);
    fd.set('orderId', line.orderId);
    startTransition(() => removeLine(fd));
  }

  return (
    <tr data-testid="line-row">
      <td className="py-2 pr-4 font-mono text-xs text-zinc-500">{line.lineNumber}</td>
      <td className="py-2 pr-4">{line.productName}</td>
      <td className="py-2 pr-4">
        {canEdit ? (
          <input
            type="number"
            min={1}
            defaultValue={line.quantity}
            aria-label={`Quantity for ${line.productName}`}
            onBlur={onQuantityBlur}
            className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm"
          />
        ) : (
          line.quantity
        )}
      </td>
      <td className="py-2 pr-4">
        {canEdit ? (
          <div className="flex items-baseline gap-2">
            <input
              type="number"
              min={0}
              step="0.01"
              defaultValue={toDollars(effective)}
              aria-label={`Unit price for ${line.productName}`}
              onBlur={onPriceBlur}
              className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm"
            />
            {hasOverride && (
              <span className="text-xs text-zinc-400 line-through">
                {usd(line.listPriceCents)}
              </span>
            )}
          </div>
        ) : (
          <span className="flex items-baseline gap-2">
            {usd(effective)}
            {hasOverride && (
              <span className="text-xs text-zinc-400 line-through">
                {usd(line.listPriceCents)}
              </span>
            )}
          </span>
        )}
      </td>
      <td className="py-2 pr-4">{usd(total)}</td>
      {canEdit && (
        <td className="py-2 pr-4">
          <button
            type="button"
            onClick={onRemove}
            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-red-700"
          >
            Remove
          </button>
        </td>
      )}
    </tr>
  );
}
