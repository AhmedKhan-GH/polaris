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
  // Emblem variants for varied backgrounds: `cutout` is the green disc with the
  // leaf knocked out (transparent — the background shows through); `leaf` is the
  // white leaf alone (for when only the mark should show).
  cutout: { src: '/zeefoods_cutout.svg', alt: 'Zee Foods emblem, knockout', width: 80, height: 80 },
  leaf: { src: '/zeefoods_leaf.svg', alt: 'Zee Foods leaf', width: 79, height: 70 },
  wordmark: { src: '/zeefoods_letters.svg', alt: 'Zee Foods', width: 200, height: 97 },
  // The full horizontal lockup (emblem + wordmark), ~2.92:1. The emblem is a true
  // circle — see public/zeefoods_lockup.svg.
  lockup: { src: '/zeefoods_lockup.svg', alt: 'Zee Foods', width: 234, height: 80 },

  // Canonical brand palette — one declared value per color, named with its role.
  // These hexes are the source of truth; the lockup SVG and the globals.css
  // @theme vars both match them (the latter proven by a weld test).
  colors: {
    blue: { name: 'Zee Foods Blue', hex: '#00447c', role: 'Primary — wordmark, headings' },
    green: { name: 'Zee Foods Green', hex: '#67953f', role: 'Accent — emblem circle' },
    white: { name: 'White', hex: '#ffffff', role: 'Emblem sprout / negative space' },
  },

  // Lockup geometry, straight from public/zeefoods_lockup.svg. Kept as data so the
  // page DERIVES its proportions instead of hardcoding them (see
  // app/_features/brand/ratios.ts). The emblem is a true circle of radius r.
  logoGeometry: {
    viewBox: { width: 112.13, height: 38.4 },
    emblem: { cx: 17.6, cy: 17.6, r: 17.6 },
  },
} as const;
