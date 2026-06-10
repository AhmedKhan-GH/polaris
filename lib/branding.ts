// Tenant identity — the ONLY home of customer-facing brand strings and asset
// references. Every component reads product name, tagline, and logo/wordmark
// from here; nothing else hardcodes a tenant string. Swapping the deployed
// tenant is a single edit to this file (and the matching SVGs in /public).
//
// `as const` freezes the literals so types stay narrow (e.g. `'Polaris'`, not
// `string`) and callers cannot mutate the shared config at runtime.
export const branding = {
  productName: 'Polaris',
  tagline: 'Cold chain logistics platform.',
  logo: { src: '/zeefoods_logo.svg', alt: 'Zee Foods logo', width: 80, height: 80 },
  wordmark: { src: '/zeefoods_letters.svg', alt: 'Zee Foods', width: 200, height: 97 },
} as const;
