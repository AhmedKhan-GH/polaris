// Pure logo-proportion math for the Brand & Identity page. No dependencies, no
// app imports. The lockup's emblem is a true circle (a literal <circle> in the
// SVG), so the proportions are a straight read of the geometry — the page derives
// them rather than hardcoding numbers that could drift from the artwork.

export type LogoGeometry = {
  /** The lockup's intrinsic viewBox dimensions, as authored. */
  viewBox: { width: number; height: number };
  /** The emblem circle's radius (a true circle: width === height === 2r). */
  emblem: { r: number };
};

export type LogoRatios = {
  /** width : height of the whole lockup. */
  lockupAspect: number;
  /** width : height of the emblem — always 1 (it is a circle). */
  emblemAspect: number;
  /** Emblem diameter as a fraction of the lockup width. */
  emblemWidthPct: number;
  /** Emblem diameter as a fraction of the lockup height. */
  emblemHeightPct: number;
};

export function computeLogoRatios(geometry: LogoGeometry): LogoRatios {
  const { viewBox, emblem } = geometry;
  const diameter = emblem.r * 2;

  return {
    lockupAspect: viewBox.width / viewBox.height,
    emblemAspect: 1,
    emblemWidthPct: diameter / viewBox.width,
    emblemHeightPct: diameter / viewBox.height,
  };
}
