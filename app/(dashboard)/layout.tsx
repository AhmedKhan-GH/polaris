import { getSessionUser } from "@/lib/auth/session";

import { PageHeader } from "../_features/shell/PageHeader";

/**
 * Shared chrome for the authenticated dashboard segment: the page header over
 * the routed page. The session is resolved here and mapped to a minimal
 * `AuthUser` for the header's auth affordance.
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
  return (
    <>
      <PageHeader user={session ? { email: session.email } : null} />
      <main className="flex-1 px-6 py-8">{children}</main>
    </>
  );
}
