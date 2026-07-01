import { getSessionUser } from "@/lib/auth/session";
import { buildAbility } from "@/lib/permissions/ability";
import { navItems } from "@/lib/registry/nav";

import { PageHeader, visibleNavItems } from "../_features/shell";

/**
 * Shared chrome for the authenticated dashboard segment: the page header over
 * the routed page. The session is resolved here, mapped to a minimal `AuthUser`
 * for the header's auth affordance, and used to build the caller's ability so the
 * header's navigation burger shows only the registry entries they may see — the
 * same filter the dashboard landing nav uses (`visibleNavItems`).
 *
 * Auth gating is intentionally NOT done here — redirecting unauthenticated
 * callers is the proxy's responsibility (verified end-to-end in Task 23). This
 * layout renders chrome only; it adds no redirect beyond what the proxy provides.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser();
  const ability = buildAbility({
    userId: session?.userId,
    roles: session?.roles ?? [],
  });

  return (
    <>
      <PageHeader
        user={session ? { email: session.email } : null}
        navItems={visibleNavItems(navItems, ability)}
      />
      <main className="flex-1 px-6 py-8">{children}</main>
    </>
  );
}
