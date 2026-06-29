/* eslint-disable @next/next/no-img-element -- static brand SVGs; next/image adds nothing for unoptimizable vectors */
import { BrandAsset, ColorSwatch, UsageExample, versionedAssetSrc } from '@/app/_features/brand';
import { branding } from '@/lib/branding';

/**
 * Brand & Identity — the canonical brand reference: downloadable logo assets, the
 * color palette, and usage guidance (one Do/Don't section per rule). A SYNC server
 * component; every value reads from `lib/branding` (the single source of truth,
 * Charter D8). Ungated; the `(dashboard)` authed gate is the only guard it needs.
 */
export default function BrandPage() {
  const colors = [branding.colors.blue, branding.colors.green, branding.colors.white];

  // Cache-bust each static SVG by content hash, so a replaced file is always
  // refetched (a /public URL is otherwise stable across edits — see asset-url.ts).
  const ver = (a: { src: string; alt: string; width: number; height: number }) => ({
    ...a,
    src: versionedAssetSrc(a.src),
  });
  const lockup = versionedAssetSrc(branding.lockup.src);
  const emblem = versionedAssetSrc(branding.logo.src);
  const wordmark = versionedAssetSrc(branding.wordmark.src);

  const assets: Array<{
    asset: { src: string; alt: string; width: number; height: number };
    label: string;
    note?: string;
    preview?: 'light' | 'dark';
  }> = [
    { asset: ver(branding.lockup), label: 'Banner (lockup)' },
    { asset: ver(branding.logo), label: 'Emblem', note: 'Green circle, white leaf' },
    {
      asset: ver(branding.cutout),
      label: 'Emblem — knockout',
      note: 'Leaf is transparent, for varied backgrounds',
      preview: 'dark',
    },
    { asset: ver(branding.leaf), label: 'Leaf', note: 'White leaf only', preview: 'dark' },
    { asset: ver(branding.wordmark), label: 'Wordmark' },
  ];

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Brand &amp; Identity</h1>
        <p className="text-sm text-zinc-600">
          The canonical brand — assets, color, and usage. One source of truth, read from{' '}
          <code className="font-mono text-xs">lib/branding.ts</code>.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium tracking-tight">Assets</h2>
        <p className="text-sm text-zinc-600">
          Download the canonical SVGs. These are the files the app itself serves.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map(({ asset, label, note, preview }) => (
            <BrandAsset key={asset.src} asset={asset} label={label} note={note} preview={preview} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium tracking-tight">Colors</h2>
        <div className="flex flex-col gap-4">
          {colors.map((color) => (
            <ColorSwatch key={color.hex} color={color} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium tracking-tight">Color use</h2>
        <p className="text-sm text-zinc-600">
          Use only the brand colors — Zee Foods Blue, Green, and White, or black on
          black-and-white media. Never recolor the logo.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <UsageExample ok caption="Brand colors (or black on B&amp;W)">
            <img src={lockup} alt="" className="max-h-12 w-auto" />
          </UsageExample>
          <UsageExample ok={false} caption="Off-brand recolor">
            <img
              src={lockup}
              alt=""
              className="max-h-12 w-auto"
              style={{ filter: 'hue-rotate(150deg) saturate(1.3)' }}
            />
          </UsageExample>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium tracking-tight">One mark per piece</h2>
        <p className="text-sm text-zinc-600">
          Place the logo or wordmark once on a given piece of media — don&apos;t repeat it.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <UsageExample ok caption="A single mark">
            <img src={lockup} alt="" className="max-h-12 w-auto" />
          </UsageExample>
          <UsageExample ok={false} caption="The same mark repeated">
            <div className="flex flex-col items-center gap-3">
              <img src={lockup} alt="" className="h-7 w-auto" />
              <img src={lockup} alt="" className="h-7 w-auto" />
              <img src={lockup} alt="" className="h-7 w-auto" />
            </div>
          </UsageExample>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium tracking-tight">Keep the proportions</h2>
        <p className="text-sm text-zinc-600">
          When the emblem and wordmark appear together, keep the lockup&apos;s set proportions —
          don&apos;t rescale or re-space them.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <UsageExample ok caption="The lockup's set proportions">
            <img src={lockup} alt="" className="max-h-12 w-auto" />
          </UsageExample>
          <UsageExample ok={false} caption="Rescaled and re-spaced">
            <div className="flex items-center gap-5">
              <img src={emblem} alt="" className="h-14 w-auto" />
              <img src={wordmark} alt="" className="h-4 w-auto" />
            </div>
          </UsageExample>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium tracking-tight">Don&apos;t split the lockup</h2>
        <p className="text-sm text-zinc-600">
          On one piece of media, use the emblem and wordmark together (the lockup) — or each on
          its own piece. Don&apos;t split them across the same piece.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <UsageExample ok caption="Together as the lockup">
            <img src={lockup} alt="" className="max-h-12 w-auto" />
          </UsageExample>
          <UsageExample ok={false} caption="Split across one piece">
            <div className="relative h-full w-full">
              <img src={emblem} alt="" className="absolute left-1 top-1 h-9 w-auto" />
              <img src={wordmark} alt="" className="absolute bottom-1 right-1 h-5 w-auto" />
            </div>
          </UsageExample>
        </div>
      </section>
    </div>
  );
}
