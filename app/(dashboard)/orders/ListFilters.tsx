import Link from 'next/link';

import { ORDER_STATUSES } from '@/app/_features/orders';

import { statusTones } from './statusTones';

/**
 * List view filter bar — narrow the orders by status and/or created-date range.
 * Server-first: the status chips are links that set `?status`, and the date
 * range is a plain GET form that puts `?from`/`?to` in the URL on submit (no
 * client JS). All filters live in the query string, so they're shareable and the
 * back button works. "Clear" drops them.
 */
export function ListFilters({
  status,
  from,
  to,
}: {
  status?: string;
  from?: string;
  to?: string;
}) {
  const statusHref = (s?: string) => {
    const p = new URLSearchParams({ view: 'list' });
    if (s) p.set('status', s);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return `/orders?${p.toString()}`;
  };
  const chip = (active: boolean, tone?: string) =>
    `rounded-full px-2 py-0.5 text-xs font-medium ${
      active
        ? (tone ?? 'bg-zinc-900 text-white')
        : 'border border-zinc-200 text-zinc-500'
    }`;

  return (
    <div className="flex flex-wrap items-end gap-4" data-testid="list-filters">
      <div className="flex flex-wrap items-center gap-1">
        <Link href={statusHref(undefined)} className={chip(!status)}>
          All
        </Link>
        {ORDER_STATUSES.map((s) => (
          <Link key={s} href={statusHref(s)} className={chip(s === status, statusTones[s])}>
            {s}
          </Link>
        ))}
      </div>

      <form className="flex items-end gap-2">
        <input type="hidden" name="view" value="list" />
        {status && <input type="hidden" name="status" value={status} />}
        <label className="flex flex-col text-xs text-zinc-500">
          From
          <input
            type="date"
            name="from"
            defaultValue={from}
            aria-label="From date"
            className="rounded border border-zinc-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-zinc-500">
          To
          <input
            type="date"
            name="to"
            defaultValue={to}
            aria-label="To date"
            className="rounded border border-zinc-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded border border-zinc-300 px-3 py-1 text-sm font-medium"
        >
          Filter
        </button>
      </form>

      {(status || from || to) && (
        <Link href="/orders?view=list" className="text-sm text-blue-700 underline">
          Clear
        </Link>
      )}
    </div>
  );
}
