'use client';

import { useState, useTransition } from 'react';

import { normalizeDollarInput } from '@/lib/money';
import { useInlineKeys } from '@/lib/use-inline-keys';

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
  const [confirmingRemove, setConfirmingRemove] = useState(false);
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

  function commitQuantity(input: HTMLInputElement) {
    const raw = input.value.trim();
    if (raw === '') return; // empty ignored — the field stays for a retry
    const n = Number(raw);
    // Quantity is a positive WHOLE number; the server's int-only validation
    // throws on anything else (which crashed the page). Reject a fractional or
    // non-positive entry here by reverting to the prior value, rather than
    // sending it. An integer-valued decimal (4.0) is fine — store it as 4.
    if (!Number.isInteger(n) || n < 1) {
      input.value = initialQty;
      return;
    }
    const value = String(n);
    if (value === initialQty) return;
    save({ quantity: value });
  }

  function commitPrice(input: HTMLInputElement) {
    // Snap to a fixed two-decimal money display (12 → 12.00, 12.999 → 13.00),
    // matching the server's round-to-cent, then apply the override rules.
    const normalized = normalizeDollarInput(input.value);
    if (normalized !== null) input.value = normalized;
    const raw = input.value.trim();
    if (raw === initialPrice) return;
    // Empty OR the list price itself clears the override (no off-list flag);
    // otherwise dollars → cents.
    const cents = raw === '' ? null : Math.round(Number(raw) * 100);
    const overridePriceCents =
      cents === null || cents === line.listPriceCents ? '' : String(cents);
    save({ overridePriceCents });
  }

  // Enter commits then deselects, Escape reverts — layered over the blur-save.
  const quantityKeys = useInlineKeys(commitQuantity);
  const priceKeys = useInlineKeys(commitPrice);

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
            step={1}
            defaultValue={line.quantity}
            aria-label={`Quantity for ${line.productName}`}
            onFocus={quantityKeys.onFocus}
            onKeyDown={quantityKeys.onKeyDown}
            onBlur={quantityKeys.onBlur}
            className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          line.quantity
        )}
      </td>
      <td className="py-2 pr-4">
        {canEdit ? (
          <div className="flex items-baseline gap-2">
            <span className="text-zinc-500">$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              defaultValue={toDollars(effective)}
              aria-label={`Unit price for ${line.productName}`}
              onFocus={priceKeys.onFocus}
              onKeyDown={priceKeys.onKeyDown}
              onBlur={priceKeys.onBlur}
              className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            onClick={() => setConfirmingRemove(true)}
            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-red-700"
          >
            Remove
          </button>
          {confirmingRemove && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Confirm remove"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            >
              <div className="flex max-w-sm flex-col gap-3 rounded bg-white p-4 text-sm shadow-lg">
                <p>
                  Remove <span className="font-medium">{line.productName}</span>{' '}
                  from this order? This can’t be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingRemove(false)}
                    className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingRemove(false);
                      onRemove();
                    }}
                    className="rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}
