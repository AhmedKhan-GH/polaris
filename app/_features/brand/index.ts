/**
 * Brand feature dev API (Iron Rule 8) — the ONLY surface the route page imports;
 * the boundary law fails the build on anything deeper. One export per line.
 *
 * NOT exported on purpose: the `nav` manifest (the registry-only seam, rule 8)
 * and the internal geometry/ratio types (the page infers them). No actions and
 * no realtime — a static brand reference needs neither.
 */
export { ColorSwatch } from './ColorSwatch';
export { LogoRatios } from './LogoRatios';
export { computeLogoRatios } from './ratios';
