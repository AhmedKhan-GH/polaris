// Pure route-protection policy, unit-testable without the Next runtime.
export function isPublicPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/login'
}

// Coarse role→route gate (owner/member both reach the dashboard for now;
// richer route policy arrives with F9/F11).
export function canAccessRoute(_role: string, _pathname: string): boolean {
  return true
}
