// Pure logo-proportion math for the Brand & Identity page. No dependencies, no
// app imports — the `lib/datetime.ts` formatter pattern, kept inside the feature
// because only this page consumes it (promote to lib/ if that ever changes).
//
// The source lockup (Asset 3222) was scaled non-uniformly in X at some point,
// turning its circular emblem into an ellipse (rx > ry). Every ratio here is
// reported AFTER un-stretching X by `ry / rx`, so the page documents the
// corrected brand, not the defect — and `correction` records what it fixed.

export type LogoGeometry = {
  /** The lockup's intrinsic viewBox dimensions, as authored. */
  viewBox: { width: number; height: number };
  /** The emblem ground ellipse from the source SVG (a true circle has rx === ry). */
  emblem: { rx: number; ry: number };
};

export type LogoRatios = {
  /** Corrected width : height of the whole lockup. */
  lockupAspect: number;
  /** Corrected width : height of the emblem — 1 once the squish is removed. */
  emblemAspect: number;
  /** Emblem width as a fraction of the corrected lockup width. */
  emblemWidthPct: number;
  /** Emblem height as a fraction of the lockup height. */
  emblemHeightPct: number;
  correction: {
    /** The source emblem's width : height (> 1 means it was stretched wide). */
    sourceEmblemAspect: number;
    /** Horizontal scale that restores the circle (`ry / rx`). */
    scaleX: number;
  };
};

export function computeLogoRatios(geometry: LogoGeometry): LogoRatios {
  const { viewBox, emblem } = geometry;
  const { rx, ry } = emblem;

  const sourceEmblemAspect = rx / ry;
  const scaleX = ry / rx;

  const correctedWidth = viewBox.width * scaleX;
  const correctedEmblemWidth = 2 * rx * scaleX; // === 2 * ry, i.e. a circle
  const emblemHeight = 2 * ry;

  return {
    lockupAspect: correctedWidth / viewBox.height,
    emblemAspect: correctedEmblemWidth / emblemHeight,
    emblemWidthPct: correctedEmblemWidth / correctedWidth,
    emblemHeightPct: emblemHeight / viewBox.height,
    correction: { sourceEmblemAspect, scaleX },
  };
}
