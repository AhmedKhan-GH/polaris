'use client';

import { useTransition } from 'react';

import { retireProduct, updateProduct } from './actions';

/**
 * One catalog row. When the caller may manage the catalog AND the product is
 * active, name and price are plain inputs that AUTO-SAVE on blur (no Save
 * button) — each a PARTIAL `updateProduct`, so the cells persist independently.
 * Price edits in DOLLARS and persists as integer cents. SKU (the immutable stock
 * key), `created_by` (the FULL uuid) and `created_at` are read-only. A retired
 * product renders
 * read-only (no inputs, no Retire) even for a manager — retiring is a one-way
 * soft delete. A blur only saves when the value actually changed (no spurious
 * writes against the catalog write budget); the route revalidates after each save.
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

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const toDollars = (cents: number) => (cents / 100).toFixed(2);

export function ProductListRow({
  product,
  canManage,
}: {
  product: ProductListRowData;
  canManage: boolean;
}) {
  const [, startTransition] = useTransition();
  const editable = canManage && !product.retired;
  const initialPrice = toDollars(product.priceCents);

  function save(fields: Record<string, string>) {
    const fd = new FormData();
    fd.set('id', product.id);
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    startTransition(() => updateProduct(fd));
  }

  function onNameBlur(e: React.FocusEvent<HTMLInputElement>) {
    const value = e.currentTarget.value.trim();
    if (value === product.name || value === '') return;
    save({ name: value });
  }

  function onPriceBlur(e: React.FocusEvent<HTMLInputElement>) {
    const raw = e.currentTarget.value.trim();
    // Empty is ignored (price is required/non-null); otherwise dollars → cents.
    if (raw === initialPrice || raw === '') return;
    save({ priceCents: String(Math.round(Number(raw) * 100)) });
  }

  function onRetire() {
    const fd = new FormData();
    fd.set('id', product.id);
    startTransition(() => retireProduct(fd));
  }

  return (
    <tr data-testid="product-row">
      <td className="py-2 pr-4">
        {editable ? (
          <input
            defaultValue={product.name}
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
          <input
            type="number"
            min={0}
            step="0.01"
            defaultValue={toDollars(product.priceCents)}
            aria-label={`Price for ${product.sku}`}
            onBlur={onPriceBlur}
            className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm"
          />
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
              onClick={onRetire}
              className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-red-700"
            >
              Retire
            </button>
          )}
        </td>
      )}
    </tr>
  );
}
