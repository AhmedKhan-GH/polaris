// Pure route-protection decision, isolated from next-auth so it is unit-testable
// without pulling the Next server runtime into the test environment.
//
// Login lives entirely in Keycloak (initiated by the header "Log in" button on
// the public landing page). There is no app /login page — unauthenticated
// requests to a protected route are sent to the landing page, where they sign in.
export function authRedirect(
  isAuthenticated: boolean,
  pathname: string,
): '/' | null {
  if (!isAuthenticated && pathname !== '/') return '/'
  return null
}
