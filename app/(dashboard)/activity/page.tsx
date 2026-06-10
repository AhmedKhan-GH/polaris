import { redirect } from 'next/navigation';

import { getSignInLog } from '@/app/_features/activity/getSignInLog';
import { getSessionUser } from '@/lib/auth/session';
import { buildAbility } from '@/lib/permissions/ability';

/**
 * The sign-in log viewer — an owner-only observability surface (Domain Charter
 * D5). Authorization is enforced TWICE on purpose: this in-page guard builds the
 * caller's ability from the composition root and bounces a non-owner to
 * /dashboard before any data is read, and `getSignInLog` re-guards the read with
 * its own `withPermission` + RLS (the backstop a Server Action could not skip).
 * The page redirect is the friendly UX layer; the query guard is the security
 * boundary. (The redirect + table render are covered by the activity E2E suite,
 * a recorded deviation, rather than a unit test for this server component.)
 */
export default async function ActivityPage() {
  const session = await getSessionUser();
  const ability = buildAbility({
    userId: session?.userId,
    roles: session?.roles ?? [],
  });
  if (!ability.can('read', 'SignInLog')) redirect('/dashboard');

  const rows = await getSignInLog();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sign-in log</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2 pr-4 font-medium">Email</th>
            <th className="py-2 pr-4 font-medium">User</th>
            <th className="py-2 pr-4 font-medium">When (UTC)</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-2 text-zinc-500">
                No sign-ins recorded yet.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td className="py-2 pr-4">{row.email}</td>
                <td className="py-2 pr-4">{row.userId ?? '—'}</td>
                <td className="py-2 pr-4">{row.createdAt.toISOString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
