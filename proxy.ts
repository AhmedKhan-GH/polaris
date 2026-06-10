import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { env } from '@/lib/env';
import { isPublicPath } from '@/lib/permissions/routes';

/**
 * Proxy (formerly Middleware — renamed in Next 16). Runs on the Node.js runtime
 * by default; the `runtime` config option is NOT settable here (Next throws if
 * you try), so it is deliberately absent.
 *
 * Its job is exactly two things, and no more:
 *   1. Refresh the Supabase session on EVERY matched request. `getUser()` calls
 *      the Auth server, which rotates the access/refresh tokens; the rotated
 *      cookies are written back onto the response via `setAll`.
 *   2. Gate public vs. authenticated routes: send unauthenticated visitors of a
 *      protected path to `/login`.
 *
 * Authorization (can THIS user do THIS thing) is NOT the proxy's job. Per the
 * Next docs, Server Function (Server Action) POSTs are handled as POSTs to the
 * route they live on, so a matcher that excludes a path also skips the action —
 * and a matcher/refactor change can silently drop coverage. Every Server Action
 * therefore self-guards (Iron Rule 5); the proxy is only an optimistic gate.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh on every matched request. Do NOT run any code between creating the
  // client and this call (Supabase's documented constraint for SSR cookie sync).
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Public paths render regardless of auth state — never redirect, even when
  // there is no user.
  if (isPublicPath(request.nextUrl.pathname)) {
    return response;
  }

  if (!user) {
    const redirect = NextResponse.redirect(new URL('/login', request.url));

    // When the refresh token is gone, the `sb-*` auth cookies are stale and
    // will never refresh again. Clear them on the redirect so the browser stops
    // resending a dead session on every subsequent request. `.code` is the
    // canonical discriminator: @supabase/auth-js types `AuthError.code` as the
    // `ErrorCode` union, which includes `'refresh_token_not_found'`.
    if (error?.code === 'refresh_token_not_found') {
      for (const { name } of request.cookies.getAll()) {
        if (name.startsWith('sb-')) redirect.cookies.delete(name);
      }
    }

    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.ico$).*)',
  ],
};
