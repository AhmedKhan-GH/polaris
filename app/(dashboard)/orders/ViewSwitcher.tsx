import Link from 'next/link';

/**
 * Console view switcher — plain links that flip `?view`, preserving the current
 * `?selected` and `?status`. Server-first: switching views is a normal
 * navigation, no client JS. The chosen view + selection live entirely in the URL
 * (shareable, back-button-safe).
 */
const VIEWS = [
  { key: 'list', label: 'List' },
  { key: 'board', label: 'Board' },
  { key: 'status', label: 'Status' },
] as const;

export function ViewSwitcher({
  view,
  selected,
  status,
}: {
  view: string;
  selected?: string;
  status?: string;
}) {
  return (
    <div className="flex gap-1" data-testid="view-switcher">
      {VIEWS.map((v) => {
        const params = new URLSearchParams({ view: v.key });
        if (selected) params.set('selected', selected);
        if (status) params.set('status', status);
        const active = v.key === view;
        return (
          <Link
            key={v.key}
            href={`/orders?${params.toString()}`}
            aria-current={active ? 'page' : undefined}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              active ? 'bg-zinc-900 text-white' : 'border border-zinc-300'
            }`}
          >
            {v.label}
          </Link>
        );
      })}
    </div>
  );
}
