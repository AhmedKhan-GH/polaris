import { ColorSwatch, LogoRatios, computeLogoRatios } from '@/app/_features/brand';
import { branding } from '@/lib/branding';

/**
 * Brand & Identity — the canonical brand reference (logo, proportions, color).
 * A SYNC server component: every value is read from `lib/branding` (the single
 * source of truth, Charter D8) and the proportions are DERIVED from the source
 * geometry, so the page can never disagree with what the app ships. Ungated; the
 * `(dashboard)` segment's authed gate (the proxy) is the only guard it needs.
 */
export default function BrandPage() {
  const ratios = computeLogoRatios(branding.logoGeometry);
  const colors = [branding.colors.blue, branding.colors.green, branding.colors.white];

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Brand &amp; Identity</h1>
        <p className="text-sm text-zinc-600">
          The canonical brand — logo, proportions, and color. One source of truth, read from{' '}
          <code className="font-mono text-xs">lib/branding.ts</code>.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium tracking-tight">Logo</h2>
        <div className="flex items-center justify-center rounded-lg border border-zinc-200 bg-white p-12">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG brand asset; next/image adds nothing for an unoptimizable vector */}
          <img
            src={branding.lockup.src}
            alt={branding.lockup.alt}
            width={branding.lockup.width}
            height={branding.lockup.height}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium tracking-tight">Proportions</h2>
        <LogoRatios ratios={ratios} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium tracking-tight">Colors</h2>
        <div className="flex flex-col gap-4">
          {colors.map((color) => (
            <ColorSwatch key={color.hex} color={color} />
          ))}
        </div>
      </section>
    </div>
  );
}
