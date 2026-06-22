'use client';

import fuzzysort from 'fuzzysort';
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  useId,
  useMemo,
  useState,
} from 'react';

/**
 * Fuzzy product picker for line-item intake — a SublimeText/Obsidian-style search
 * over SKU + name (via `fuzzysort`), with matched characters highlighted, full
 * keyboard control (↑/↓/Enter/Esc), and a hidden `productId` input so the
 * surrounding add-line `<form>` submits exactly as it did with the old `<select>`.
 *
 * Products are passed in by the route (which composes the products dev-API);
 * this component never imports the products feature (boundary rule B) — it takes
 * a minimal structural shape.
 */
export type ProductOption = {
  id: string;
  sku: string;
  name: string;
  priceCents: number;
};

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const mark = (m: string, i: number): ReactNode => (
  <mark key={i} className="rounded-sm bg-amber-200 text-inherit">
    {m}
  </mark>
);

export function ProductCombobox({ products }: { products: readonly ProductOption[] }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const listboxId = useId();

  const results = useMemo(() => {
    const q = query.trim();
    // Highlight each field INDEPENDENTLY. fuzzysort's per-key result is an
    // empty-target Result for a key that didn't match, so deriving the SKU/name
    // from `r[0]`/`r[1]` would blank out whichever field you didn't search by.
    // `single()` per field guarantees BOTH always render — matched chars
    // highlighted, the rest plain.
    const fmt = (value: string): ReactNode => {
      const res = q ? fuzzysort.single(q, value) : null;
      return res ? <>{res.highlight(mark)}</> : <>{value}</>;
    };
    const matched = q
      ? fuzzysort.go(q, products, { keys: ['sku', 'name'], limit: 8 }).map((r) => r.obj)
      : products.slice(0, 8);
    return matched.map((obj) => ({ obj, sku: fmt(obj.sku), name: fmt(obj.name) }));
  }, [query, products]);

  function select(p: ProductOption) {
    setSelectedId(p.id);
    setQuery(`${p.sku} — ${p.name}`);
    setOpen(false);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setSelectedId(''); // editing invalidates the prior pick — must re-select
    setHighlighted(0);
    setOpen(true);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlighted((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && results[highlighted]) {
        e.preventDefault();
        select(results[highlighted].obj);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-label="Product"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        required
        placeholder="Search SKU or name…"
        value={query}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        className="w-72 rounded border border-zinc-300 px-3 py-2 text-sm"
      />
      <input type="hidden" name="productId" value={selectedId} />
      {open && results.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-72 overflow-auto rounded border border-zinc-300 bg-white text-sm text-zinc-900 shadow-lg"
        >
          {results.map((r, i) => (
            <li
              key={r.obj.id}
              role="option"
              aria-selected={i === highlighted}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => select(r.obj)}
              className={`flex cursor-pointer items-baseline gap-2 px-3 py-1.5 ${
                i === highlighted ? 'bg-zinc-100' : ''
              }`}
            >
              <span className="font-mono text-xs">{r.sku}</span>
              <span>{r.name}</span>
              <span className="ml-auto text-zinc-500">{usd(r.obj.priceCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
