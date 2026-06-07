// Pure route-protection decision, isolated from next-auth so it is unit-testable
// without pulling the Next server runtime into the test environment.
export function authRedirect(
  isAuthenticated: boolean,
  pathname: string,
): '/login' | '/dashboard' | null {
  const isPublic = pathname === '/' || pathname.startsWith('/login')

  if (!isAuthenticated && !isPublic) return '/login'
  if (isAuthenticated && pathname.startsWith('/login')) return '/dashboard'
  return null
}
