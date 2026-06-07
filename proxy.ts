import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { authRedirect } from '@/lib/route-guard'

export default auth((request) => {
  const target = authRedirect(!!request.auth?.user, request.nextUrl.pathname)
  if (target) {
    return NextResponse.redirect(new URL(target, request.nextUrl))
  }
  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.ico$).*)',
  ],
}
