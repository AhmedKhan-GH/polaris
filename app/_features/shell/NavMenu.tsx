'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { NavItem } from '@/lib/registry/nav';

const DRAWER_ID = 'app-nav-drawer';

/**
 * The top-left burger that opens a left drawer of app navigation — the app's
 * primary wayfinding, reachable from every dashboard page (replacing the old
 * history-based back button).
 *
 * A client island because it owns open/close state; it takes an already
 * permission-filtered `NavItem[]` (plain data — no ability, no registry beyond
 * the type, mirroring `DashboardNav`), so the authz decision stays server-side.
 * Closes on link click, backdrop, the close button, and Escape; the active route
 * is marked with `aria-current`.
 */
export function NavMenu({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls={DRAWER_ID}
        onClick={() => setOpen(true)}
        className="-ml-1 rounded p-1 text-ink-muted transition-colors hover:text-ink"
      >
        <span aria-hidden="true" className="block text-lg leading-none">
          ☰
        </span>
      </button>

      {open && (
        <>
          <div
            data-testid="nav-scrim"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/40"
          />
          <div
            id={DRAWER_ID}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col border-r border-hairline-strong bg-surface p-4 shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                Menu
              </span>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-ink-muted transition-colors hover:text-ink"
              >
                <span aria-hidden="true" className="block text-lg leading-none">
                  ✕
                </span>
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={`rounded px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-surface-alt font-medium text-ink'
                        : 'text-ink-muted hover:bg-surface-alt hover:text-ink'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
