'use client';

import { useState, useTransition } from 'react';

import { normalizeDollarInput } from '@/lib/money';

import { createProduct } from './actions';

/**
 * Catalog create form (owner-only; the page gates rendering). Submits name, sku,
 * and a DOLLARS price to `createProduct`, which RETURNS a result instead of
 * throwing for caller-correctable failures — a validation error or a DUPLICATE
 * SKU. We surface that message inline (and KEEP the entered values so the owner
 * can fix the SKU and resubmit); on success we clear the form. JS-driven via a
 * plain onSubmit — the catalog is an authed dashboard surface — so the form
 * controls its own reset (React's form-action auto-reset would wipe the values
 * on an error too).
 */
export function ProductCreateForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Snap the price box to a fixed two-decimal money display when the owner leaves
  // it (12 → 12.00, 12.999 → 13.00) — the value the server then rounds to cents.
  function onPriceBlur(e: React.FocusEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const normalized = normalizeDollarInput(input.value);
    if (normalized !== null) input.value = normalized;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await createProduct(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        form.reset();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-start gap-2">
      <input
        name="name"
        required
        maxLength={200}
        aria-label="Product name"
        placeholder="Name"
        className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
      />
      <input
        name="sku"
        required
        maxLength={100}
        aria-label="SKU"
        placeholder="SKU"
        className="w-40 rounded border border-zinc-300 px-3 py-2 text-sm"
      />
      <span className="flex items-baseline gap-1">
        <span className="text-zinc-500">$</span>
        <input
          name="price"
          type="number"
          min={0}
          step="0.01"
          required
          aria-label="Price ($)"
          placeholder="0.00"
          onBlur={onPriceBlur}
          className="w-32 rounded border border-zinc-300 px-3 py-2 text-sm"
        />
      </span>
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Adding…' : 'Add product'}
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
