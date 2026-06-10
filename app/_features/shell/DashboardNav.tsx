import Link from 'next/link';

import type { NavItem } from '@/lib/registry/nav';

/**
 * Render the dashboard navigation from a flat list of registry entries.
 *
 * Presentational and dependency-light: it accepts a minimal `ability` (only the
 * `can(action, subject)` predicate it needs) rather than a full CASL ability, so
 * it can be unit-tested with a plain stub and never couples to the authz engine.
 * An entry without a `permission` is always shown; a gated entry is shown only
 * when the ability grants its action on its subject. With today's empty registry
 * this renders an empty <nav> — chrome only, zero feature links.
 */
export function DashboardNav({
  items,
  ability,
}: {
  items: NavItem[];
  ability: { can(action: string, subject: string): boolean };
}) {
  const visible = items.filter((item) =>
    item.permission
      ? ability.can(item.permission.action, item.permission.subject)
      : true,
  );

  return (
    <nav className="flex gap-4">
      {visible.map((item) => (
        <Link key={item.href} href={item.href} className="text-sm">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
