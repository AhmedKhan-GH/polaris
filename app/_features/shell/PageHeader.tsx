import Link from 'next/link';

import type { AuthUser } from '@/lib/auth/user';
import { branding } from '@/lib/branding';
import type { NavItem } from '@/lib/registry/nav';

import { signOutAction } from '../auth';
import { NavMenu } from './NavMenu';
import { PreferenceControls } from './PreferenceControls';

/**
 * The shared top-of-page chrome: a brand home link plus an auth affordance, and —
 * where the caller supplies them — the app-navigation burger on the far left.
 *
 * Server component — it carries no interactivity of its own. When authed it
 * renders a sign-out form whose submit button invokes `signOutAction` (the one
 * sanctioned shell -> auth edge); when anonymous it links to the login page.
 * `navItems`, when non-empty, mounts the `NavMenu` burger (the dashboard passes
 * the caller's permission-filtered entries; the anonymous landing passes none).
 * Brand text is read from `@/lib/branding`, never hardcoded.
 */
export function PageHeader({
  user,
  navItems,
}: {
  user: AuthUser | null;
  navItems?: NavItem[];
}) {
  return (
    <header className="flex items-center justify-between border-t-2 border-t-brand-line border-b border-hairline bg-brand-line-soft px-6 py-4">
      <div className="flex items-center gap-3">
        {navItems && navItems.length > 0 ? <NavMenu items={navItems} /> : null}
        <Link href="/" className="font-semibold tracking-tight">
          {branding.productName}
        </Link>
      </div>
      {user ? (
        <div className="flex items-center gap-4">
          <PreferenceControls />
          <form action={signOutAction}>
            <button type="submit" className="text-sm">
              Log out
            </button>
          </form>
        </div>
      ) : (
        <Link href="/login" className="text-sm">
          Log in
        </Link>
      )}
    </header>
  );
}
