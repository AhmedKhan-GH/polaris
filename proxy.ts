import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { env } from '@/lib/env'
import { isPublicPath, canAccessRoute } from '@/lib/permissions/routes'

// Edge proxy (Next 16's renamed Middleware). Refreshes the Supabase session
// cookie on every request and performs an optimistic auth redirect. Real
// authorization is enforced in server actions/components (withPermission) + RLS.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirect = NextResponse.redirect(url)
    if (error?.code === 'refresh_token_not_found') {
      request.cookies.getAll().forEach(({ name }) => {
        if (name.startsWith('sb-')) redirect.cookies.delete(name)
      })
    }
    return redirect
  }

  if (user && !isPublicPath(pathname)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!canAccessRoute(profile?.role ?? 'member', pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.ico$).*)',
  ],
}
