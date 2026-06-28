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
  // The full horizontal lockup (emblem + wordmark), corrected to a true circular
  // emblem — see public/zeefoods_lockup.svg. Roughly 2.8:1 once un-stretched.
  lockup: { src: '/zeefoods_lockup.svg', alt: 'Zee Foods', width: 224, height: 80 },

  // Canonical brand palette — one declared value per color, named with its role.
  // These hexes are the source of truth; the lockup SVG and the globals.css
  // @theme vars both match them (the latter proven by a weld test).
  colors: {
    blue: { name: 'Zee Foods Blue', hex: '#00447c', role: 'Primary — wordmark, headings' },
    green: { name: 'Zee Foods Green', hex: '#67953f', role: 'Accent — emblem mark' },
    white: { name: 'White', hex: '#ffffff', role: 'Emblem ground / negative space' },
  },

  // Source emblem + viewBox geometry, straight from the original artwork. Kept as
  // data so the page DERIVES its proportions (and the circle correction) instead
  // of hardcoding them — see app/_features/brand/ratios.ts.
  logoGeometry: {
    viewBox: { width: 111.51, height: 38.39 },
    emblem: { rx: 16.11, ry: 15.52 },
  },
} as const;
