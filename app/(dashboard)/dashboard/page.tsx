import { getSessionUser } from "@/lib/auth/session";
import { buildAbility } from "@/lib/permissions/ability";
import { navItems } from "@/lib/registry/nav";

import { DashboardNav } from "../../_features/shell/DashboardNav";

/**
 * The dashboard home. Resolves the caller's identity, builds their ability from
 * the composition root, and hands both the registry's nav items and that ability
 * to `DashboardNav`, which renders only the entries the caller may see. With
 * today's empty registry this is chrome plus a heading — zero feature links.
 */
export default async function DashboardPage() {
  const session = await getSessionUser();
  const ability = buildAbility({
    userId: session?.userId,
    roles: session?.roles ?? [],
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <DashboardNav items={navItems} ability={ability} />
    </div>
  );
}
