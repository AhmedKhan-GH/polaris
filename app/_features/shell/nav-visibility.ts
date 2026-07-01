import type { NavItem } from '@/lib/registry/nav';

/**
 * The single filter that decides which registry nav entries a caller may see.
 *
 * An entry without a `permission` is always kept; a gated entry is kept only when
 * the ability grants its action on its subject. Takes a minimal ability (just the
 * `can` predicate) so it stays decoupled from CASL and trivially unit-testable.
 * Shared by `DashboardNav` (the landing nav) and the dashboard layout (which
 * feeds the already-filtered list to the burger menu).
 */
export function visibleNavItems(
  items: NavItem[],
  ability: { can(action: string, subject: string): boolean },
): NavItem[] {
  return items.filter((item) =>
    item.permission
      ? ability.can(item.permission.action, item.permission.subject)
      : true,
  );
}
