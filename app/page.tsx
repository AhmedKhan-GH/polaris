import { getSessionUser } from "@/lib/auth/session";

import { LandingPage } from "./_features/landing/LandingPage";
import { PageHeader } from "./_features/shell/PageHeader";

/**
 * Public landing route. Resolves the session here (server side) and hands the
 * presentational pieces a minimal `AuthUser` (or `null` when anonymous), so they
 * stay free of auth-provider details.
 *
 * The route is the composition seam: it wires the `shell` chrome (PageHeader)
 * around the `landing` hero. Features may not import each other (Charter §1.1),
 * but a route file (outside `app/_features`) is the sanctioned place to compose
 * them.
 */
export default async function Home() {
  const session = await getSessionUser();
  const user = session ? { email: session.email } : null;
  return (
    <>
      <PageHeader user={user} />
      <LandingPage user={user} />
    </>
  );
}
