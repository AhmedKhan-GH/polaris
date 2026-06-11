/**
 * Activity dev API (Iron Rule 8, ADR-0005). `getSignInLog` is a plain
 * server-side reader (no 'use server' directive): server components only.
 * A future CLIENT component must not import this index — split the entry
 * points in that PR (recorded constraint, ADR-0005). Manifests
 * (`permissions.ts`/`nav.ts`) stay on the registry seam, not here.
 */
export { getSignInLog } from './getSignInLog';
