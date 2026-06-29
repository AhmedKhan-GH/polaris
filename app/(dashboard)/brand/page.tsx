/* eslint-disable @next/next/no-img-element -- static brand SVGs; next/image adds nothing for unoptimizable vectors */
import type { CSSProperties, ReactNode } from 'react';

import { BrandAsset, ColorSwatch, UsageExample, versionedAssetSrc } from '@/app/_features/brand';
import { branding } from '@/lib/branding';

/**
 * Brand & Identity — the canonical brand reference: downloadable logo assets, the
 * color palette, and a Do/Don't usage guide (one section per rule, each with many
 * compact examples). A SYNC server component; every value reads from `lib/branding`
 * (the single source of truth, Charter D8). Ungated; the `(dashboard)` authed gate
 * is the only guard it needs.
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
  const cutout = versionedAssetSrc(branding.cutout.src); // leaf is knockout — survives a flat fill
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

  // A brand mark image, optionally recolored/transformed to demonstrate (mis)use.
  const mk = (src: string, h: string, style?: CSSProperties): ReactNode => (
    <img src={src} alt="" className={`${h} w-auto`} style={style} />
  );

  // A stack of placeholder text lines, for the placement mockups.
  const body = (widths: string[]): ReactNode => (
    <div className="flex w-full flex-col gap-1">
      {widths.map((w, i) => (
        <div key={i} className={`h-1 rounded-full bg-zinc-200 ${w}`} />
      ))}
    </div>
  );

  type Ex = { ok: boolean; caption: string; dark?: boolean; node: ReactNode };
  const cases: Array<{ title: string; desc: string; examples: Ex[] }> = [
    {
      title: 'Color use',
      desc: "Use only the brand colors — blue, green, and white — or solid black on black-and-white media. Black fills and reversed white are fine; recoloring, tints, greys, and low contrast are not.",
      examples: [
        { ok: true, caption: 'Brand colors', node: mk(lockup, 'h-6') },
        { ok: true, caption: 'Emblem, brand colors', node: mk(emblem, 'h-10') },
        { ok: true, caption: 'One-color black', node: mk(lockup, 'h-6', { filter: 'brightness(0)' }) },
        { ok: true, caption: 'Black emblem', node: mk(cutout, 'h-10', { filter: 'brightness(0)' }) },
        {
          ok: true,
          caption: 'Reversed white on dark',
          dark: true,
          node: mk(lockup, 'h-6', { filter: 'brightness(0) invert(1)' }),
        },
        { ok: false, caption: 'Recolored', node: mk(lockup, 'h-6', { filter: 'hue-rotate(150deg) saturate(1.4)' }) },
        { ok: false, caption: 'Tinted', node: mk(lockup, 'h-6', { filter: 'sepia(1) saturate(6) hue-rotate(-20deg)' }) },
        { ok: false, caption: 'Greyed (use solid black)', node: mk(lockup, 'h-6', { filter: 'grayscale(1)' }) },
        { ok: false, caption: 'Low contrast', node: mk(lockup, 'h-6', { opacity: 0.25 }) },
      ],
    },
    {
      title: 'One mark per piece',
      desc: 'Use the logo or wordmark once on a given piece of media — never repeat, tile, or stack marks.',
      examples: [
        { ok: true, caption: 'A single mark', node: mk(lockup, 'h-6') },
        { ok: true, caption: 'Emblem, once', node: mk(emblem, 'h-10') },
        {
          ok: false,
          caption: 'Repeated',
          node: (
            <div className="flex flex-col items-center gap-1">
              {mk(lockup, 'h-3')}
              {mk(lockup, 'h-3')}
              {mk(lockup, 'h-3')}
            </div>
          ),
        },
        {
          ok: false,
          caption: 'Tiled',
          node: (
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {mk(emblem, 'h-5')}
              {mk(emblem, 'h-5')}
              {mk(emblem, 'h-5')}
              {mk(emblem, 'h-5')}
            </div>
          ),
        },
        {
          ok: false,
          caption: 'Two marks at once',
          node: (
            <div className="flex items-center gap-2">
              {mk(emblem, 'h-8')}
              {mk(lockup, 'h-4')}
            </div>
          ),
        },
      ],
    },
    {
      title: 'Keep the proportions',
      desc: "Keep the lockup's set proportions — never stretch, squish, rotate, or re-space the emblem and wordmark.",
      examples: [
        { ok: true, caption: 'Set proportions', node: mk(lockup, 'h-6') },
        { ok: false, caption: 'Stretched', node: mk(lockup, 'h-6', { transform: 'scaleX(1.6)' }) },
        { ok: false, caption: 'Squished', node: mk(lockup, 'h-8', { transform: 'scaleX(0.5)' }) },
        {
          ok: false,
          caption: 'Rescaled & re-spaced',
          node: (
            <div className="flex items-center gap-3">
              {mk(emblem, 'h-11')}
              {mk(wordmark, 'h-3')}
            </div>
          ),
        },
        { ok: false, caption: 'Rotated', node: mk(lockup, 'h-6', { transform: 'rotate(8deg)' }) },
      ],
    },
    {
      title: "Don't split the lockup",
      desc: 'Use the emblem and wordmark together as the lockup, or each on its own. Never split the lockup across one piece.',
      examples: [
        { ok: true, caption: 'Together (the lockup)', node: mk(lockup, 'h-6') },
        { ok: true, caption: 'Emblem alone', node: mk(emblem, 'h-10') },
        { ok: true, caption: 'Wordmark alone', node: mk(wordmark, 'h-4') },
        {
          ok: false,
          caption: 'Split to corners',
          node: (
            <div className="relative h-full w-full">
              <img src={emblem} alt="" className="absolute left-0 top-0 h-7 w-auto" />
              <img src={wordmark} alt="" className="absolute bottom-0 right-0 h-3.5 w-auto" />
            </div>
          ),
        },
        {
          ok: false,
          caption: 'Split, side by side',
          node: (
            <div className="flex items-center gap-6">
              {mk(emblem, 'h-7')}
              {mk(wordmark, 'h-3')}
            </div>
          ),
        },
      ],
    },
    {
      title: 'Placement',
      desc: 'Place the mark at the top, before the text — the emblem or full lockup at the left, or the wordmark by itself at the right, but never both at once. Never center it, put the full lockup on the right, or set it in the middle of the text, after it, or at the bottom.',
      examples: [
        {
          ok: true,
          caption: 'Top-left',
          node: (
            <div className="flex h-full w-full flex-col gap-2">
              <img src={emblem} alt="" className="h-6 w-auto self-start" />
              {body(['w-full', 'w-full', 'w-3/4'])}
            </div>
          ),
        },
        {
          ok: true,
          caption: 'Top-left, with wordmark',
          node: (
            <div className="flex h-full w-full flex-col gap-2">
              <img src={lockup} alt="" className="h-4 w-auto self-start" />
              {body(['w-full', 'w-full', 'w-3/4'])}
            </div>
          ),
        },
        {
          ok: true,
          caption: 'Wordmark, top-right',
          node: (
            <div className="flex h-full w-full flex-col gap-2">
              <img src={wordmark} alt="" className="h-4 w-auto self-end" />
              {body(['w-full', 'w-full', 'w-3/4'])}
            </div>
          ),
        },
        {
          ok: false,
          caption: 'Emblem left + wordmark right',
          node: (
            <div className="flex h-full w-full flex-col gap-2">
              <div className="flex w-full items-center justify-between">
                <img src={emblem} alt="" className="h-6 w-auto" />
                <img src={wordmark} alt="" className="h-4 w-auto" />
              </div>
              {body(['w-full', 'w-full', 'w-3/4'])}
            </div>
          ),
        },
        {
          ok: false,
          caption: 'Lockup on the right',
          node: (
            <div className="flex h-full w-full flex-col gap-2">
              <img src={lockup} alt="" className="h-4 w-auto self-end" />
              {body(['w-full', 'w-full', 'w-3/4'])}
            </div>
          ),
        },
        {
          ok: false,
          caption: 'Logo centered',
          node: (
            <div className="flex h-full w-full flex-col gap-2">
              <img src={emblem} alt="" className="h-6 w-auto self-center" />
              {body(['w-full', 'w-full', 'w-3/4'])}
            </div>
          ),
        },
        {
          ok: false,
          caption: 'In the middle of the text',
          node: (
            <div className="flex h-full w-full flex-col gap-2">
              {body(['w-full', 'w-5/6'])}
              <img src={emblem} alt="" className="h-6 w-auto self-center" />
              {body(['w-full', 'w-3/4'])}
            </div>
          ),
        },
        {
          ok: false,
          caption: 'After the text',
          node: (
            <div className="flex h-full w-full flex-col gap-2">
              {body(['w-full', 'w-full', 'w-full', 'w-2/3'])}
              <img src={emblem} alt="" className="h-6 w-auto self-start" />
            </div>
          ),
        },
        {
          ok: false,
          caption: 'At the bottom',
          node: (
            <div className="flex h-full w-full flex-col gap-2">
              {body(['w-full', 'w-5/6'])}
              <img src={emblem} alt="" className="mt-auto h-6 w-auto self-center" />
            </div>
          ),
        },
      ],
    },
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

      {cases.map((c) => (
        <section key={c.title} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-medium tracking-tight">{c.title}</h2>
            <p className="max-w-3xl text-sm text-zinc-600">{c.desc}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {c.examples.map((ex, i) => (
              <UsageExample key={`${c.title}-${i}`} ok={ex.ok} caption={ex.caption} dark={ex.dark}>
                {ex.node}
              </UsageExample>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
