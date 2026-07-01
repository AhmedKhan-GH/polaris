// WCAG 2.1 relative-luminance contrast ratio for two sRGB hex colors. Pure and
// dependency-free: it PROVES the palette meets AA (palette.test) and LABELS the
// status swatches on the Brand page. Formula per WCAG §1.4.3.

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrast ratio in [1, 21]; order-independent. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** True when the pair clears WCAG AA for normal-size text (4.5:1). */
export function meetsAA(a: string, b: string): boolean {
  return contrastRatio(a, b) >= 4.5;
}
