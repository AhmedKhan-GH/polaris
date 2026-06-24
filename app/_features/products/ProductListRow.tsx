'use client';

import { useState, useTransition } from 'react';

import { restoreProduct, retireProduct, updateProduct } from './actions';

/**
 * One catalog row. When the caller may manage the catalog AND the product is
 * active, name and price are plain inputs that AUTO-SAVE on blur (no Save button)
 * — each a PARTIAL `updateProduct`, so the cells persist independently. Price
 * edits in DOLLARS (with a `$` adornment outside the box) and persists as integer
 * cents. SKU (the immutable stock key), `created_by` (the FULL uuid) and
 * `created_at` are read-only. Retiring is a REVERSIBLE soft hide (gated behind a
 * confirmation dialog): a retired product renders read-only with a Restore action
 * instead of edit controls, even for a manager. A blur only saves when the value
 * actually changed (no spurious writes against the catalog write budget); the
 * route revalidates after each save.
 */
export type ProductListRowData = {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  retired: boolean;
  createdBy: string;
  createdAt: string;
};

const usd = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  );
const toDollars = (cents: number) => (cents / 100).toFixed(2);

export function ProductListRow({
  product,
  canManage,
}: {
  product: ProductListRowData;
  canManage: boolean;
}) {
  const [isSaving, startTransition] = useTransition();
  const [confirmingRetire, setConfirmingRetire] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const editable = canManage && !product.retired;
  const initialPrice = toDollars(product.priceCents);

  function save(fields: Record<string, string>) {
    const fd = new FormData();
    fd.set('id', product.id);
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    // Auto-save on blur has no Save button to report failure, so clear any prior
    // error and surface a new one if this write is rejected (e.g. the write
    // budget tripping) — the typed value stays in the input for a retry.
    setSaveError(null);
    startTransition(async () => {
      try {
        await updateProduct(fd);
      } catch {
        setSaveError('Couldn’t save your change — please try again.');
      }
    });
  }

  function onNameBlur(e: React.FocusEvent<HTMLInputElement>) {
    const value = e.currentTarget.value.trim();
    if (value === product.name || value === '') return;
    save({ name: value });
  }

  function onPriceBlur(e: React.FocusEvent<HTMLInputElement>) {
    const raw = e.currentTarget.value.trim();
    // Empty is ignored (price is required); the server converts dollars → cents.
    if (raw === initialPrice || raw === '') return;
    save({ price: raw });
  }

  function onRetire() {
    const fd = new FormData();
    fd.set('id', product.id);
    startTransition(() => retireProduct(fd));
  }

  function onRestore() {
    const fd = new FormData();
    fd.set('id', product.id);
    startTransition(() => restoreProduct(fd));
  }

  return (
    <tr data-testid="product-row">
      <td className="py-2 pr-4">
        {editable ? (
          <input
            defaultValue={product.name}
            maxLength={200}
            aria-label={`Name for ${product.sku}`}
            onBlur={onNameBlur}
            className="w-40 rounded border border-zinc-300 px-2 py-1 text-sm"
          />
        ) : (
          product.name
        )}
      </td>
      <td className="py-2 pr-4">{product.sku}</td>
      <td className="py-2 pr-4">
        {editable ? (
          <span className="flex items-baseline gap-1">
            <span className="text-zinc-500">$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              defaultValue={toDollars(product.priceCents)}
              aria-label={`Price for ${product.sku}`}
              onBlur={onPriceBlur}
              className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </span>
        ) : (
          usd(product.priceCents)
        )}
      </td>
      <td className="py-2 pr-4 text-zinc-500">
        {product.retired ? 'Retired' : 'Active'}
      </td>
      <td className="py-2 pr-4 font-mono text-xs">{product.createdBy}</td>
      <td className="py-2 pr-4">{product.createdAt}</td>
      {canManage && (
        <td className="py-2 pr-4">
          {editable && (
            <button
              type="button"
              onClick={() => setConfirmingRetire(true)}
              className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-red-700"
            >
              Retire
            </button>
          )}
          {product.retired && (
            <button
              type="button"
              onClick={onRestore}
              className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium"
            >
              Restore
            </button>
          )}
          {confirmingRetire && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Confirm retire"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            >
              <div className="flex max-w-sm flex-col gap-3 rounded bg-white p-4 text-sm shadow-lg">
                <p>
                  Retire <span className="font-medium">{product.name}</span>? It
                  will be hidden from the catalog and the line-item picker.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingRetire(false)}
                    className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingRetire(false);
                      onRetire();
                    }}
                    className="rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
          {isSaving && (
            <span className="ml-2 text-xs text-zinc-500">Saving…</span>
          )}
          {saveError && (
            <p role="alert" className="mt-1 text-xs text-red-700">
              {saveError}
            </p>
          )}
        </td>
      )}
    </tr>
  );
}
