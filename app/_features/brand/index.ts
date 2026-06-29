/**
 * Brand feature dev API (Iron Rule 8) — the ONLY surface the route page imports;
 * the boundary law fails the build on anything deeper. One export per line.
 *
 * NOT exported on purpose: the `nav` manifest (the registry-only seam, rule 8).
 * No actions and no realtime — a static brand reference needs neither.
 */
export { BrandAsset } from './BrandAsset';
export { ColorSwatch } from './ColorSwatch';
export { UsageExample } from './UsageExample';
export { versionedAssetSrc } from './asset-url';
