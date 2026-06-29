import Link from 'next/link';

import type { AuthUser } from '@/lib/auth/user';
import { branding } from '@/lib/branding';

/**
 * The public landing hero — the `<main>` body of the landing route.
 *
 * Server component. All copy and asset references come from `@/lib/branding`, so
 * nothing here is a hardcoded tenant string. The shared page chrome (PageHeader)
 * is composed by the route, not imported here: PageHeader is a `shell` feature,
 * and a feature may not import another feature (Charter §1.1, only shell -> auth
 * is sanctioned). The route file is the composition seam that is allowed to wire
 * `shell` and `landing` together.
 *
 * The brand marks are static SVGs served from /public; next/image would add a
 * loader/optimizer that buys an SVG nothing, so plain <img> is the deliberate
 * choice (see eslint-disable below).
 */
export function LandingPage({ user }: { user: AuthUser | null }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      {/* The combined lockup (emblem + wordmark together, at their set proportions).
          The brand guide forbids splitting them on one piece of media — see
          /brand → "Don't split the lockup". */}
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG brand asset; next/image adds nothing for an unoptimizable vector */}
      <img
        src={branding.lockup.src}
        alt={branding.lockup.alt}
        width={branding.lockup.width}
        height={branding.lockup.height}
      />
      <h1 className="text-3xl font-semibold tracking-tight">
        {branding.productName}
      </h1>
      <p className="text-zinc-600">{branding.tagline}</p>
      {user ? (
        <Link
          href="/dashboard"
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          Dashboard
        </Link>
      ) : null}
    </main>
  );
}
