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
  const lockupOnDark = versionedAssetSrc(branding.lockup.onDark); // green emblem, white wordmark
  const lockupBlack = versionedAssetSrc(branding.lockup.black); // punchout: black disc, knocked-out sprout
  // A deliberately MIS-colored lockup — brand green/blue swapped, sprout still white —
  // used only to demonstrate the "colors swapped" Don't below. Not a brand asset.
  const lockupSwapped = versionedAssetSrc('/zeefoods_lockup_swapped.svg');
  const emblem = versionedAssetSrc(branding.logo.src);
  const emblemBlack = versionedAssetSrc(branding.logo.black); // punchout: black disc, knocked-out sprout
  const leafBlack = versionedAssetSrc(branding.leaf.black); // solid black sprout — faint = a grey watermark
  const wordmark = versionedAssetSrc(branding.wordmark.src);

  // A versioned colorway option.
  const dl = (label: string, src: string) => ({ label, src: versionedAssetSrc(src) });

  const assets: Array<{
    asset: { src: string; alt: string; width: number; height: number };
    label: string;
    note?: string;
    variants: Array<{ label: string; src: string }>;
  }> = [
    {
      asset: ver(branding.lockup),
      label: 'Lockup',
      variants: [
        dl('Color', branding.lockup.src),
        dl('On Dark', branding.lockup.onDark),
        dl('Black', branding.lockup.black),
        dl('White', branding.lockup.white),
      ],
    },
    {
      asset: ver(branding.logo),
      label: 'Emblem',
      note: 'Green disc, white leaf',
      variants: [
        dl('Color', branding.logo.src),
        dl('Black', branding.logo.black),
        dl('White', branding.logo.white),
      ],
    },
    {
      asset: ver(branding.leaf),
      label: 'Leaf',
      note: 'White (for dark), black, and green',
      variants: [
        dl('Color', branding.leaf.green),
        dl('White', branding.leaf.src),
        dl('Black', branding.leaf.black),
      ],
    },
    {
      asset: ver(branding.wordmark),
      label: 'Wordmark',
      variants: [
        dl('Color', branding.wordmark.src),
        dl('Black', branding.wordmark.black),
        dl('White', branding.wordmark.white),
      ],
    },
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

  type Ex = { ok: boolean; caption: string; ground?: 'white' | 'grey' | 'dark'; node: ReactNode };
  const cases: Array<{ title: string; desc: string; examples: Ex[] }> = [
    {
      title: 'Color use',
      desc: 'The lockup and the emblem are both valid in the brand colors. Use the one-color black mark on light grounds only, and the On Dark lockup on dark grounds only. Never swap or recolor the marks, tint or grey them, or drop the contrast.',
      examples: [
        { ok: true, caption: 'Lockup', node: mk(lockup, 'h-6') },
        { ok: true, caption: 'Emblem', node: mk(emblem, 'h-10') },
        { ok: true, caption: 'Black — light grounds only', ground: 'grey', node: mk(lockupBlack, 'h-6') },
        { ok: true, caption: 'Black emblem — light grounds only', ground: 'grey', node: mk(emblemBlack, 'h-10') },
        { ok: true, caption: 'On Dark — dark grounds only', ground: 'dark', node: mk(lockupOnDark, 'h-6') },
        { ok: false, caption: 'Colors swapped', node: mk(lockupSwapped, 'h-6') },
        { ok: false, caption: 'Recolored', node: mk(emblem, 'h-10', { filter: 'hue-rotate(210deg) saturate(4)' }) },
        { ok: false, caption: 'Tinted', node: mk(lockup, 'h-6', { filter: 'grayscale(1) sepia(1) saturate(12)' }) },
        { ok: false, caption: 'Greyed (use solid black)', node: mk(lockup, 'h-6', { filter: 'grayscale(1)' }) },
        { ok: false, caption: 'Low contrast', node: mk(lockup, 'h-6', { opacity: 0.25 }) },
      ],
    },
    {
      title: 'Using the mark',
      desc: 'Use the lockup, or the emblem on its own, as a single whole unit. One mark per piece — never repeat, tile, or stack. Keep the set proportions — never stretch, squish, rotate, or re-space. Never split the lockup, use the wordmark by itself, or break it apart.',
      examples: [
        { ok: true, caption: 'The lockup', node: mk(lockup, 'h-6') },
        { ok: true, caption: 'Emblem alone', node: mk(emblem, 'h-10') },
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
        { ok: false, caption: 'Stretched (preserve aspect ratio)', node: mk(lockup, 'h-6', { transform: 'scaleX(1.6)' }) },
        {
          ok: false,
          caption: 'Rescaled separately',
          node: (
            <div className="flex items-center gap-3">
              {mk(emblem, 'h-11')}
              {mk(wordmark, 'h-3')}
            </div>
          ),
        },
        { ok: false, caption: 'Rotated', node: mk(lockup, 'h-6', { transform: 'rotate(8deg)' }) },
        { ok: false, caption: 'Wordmark by itself', node: mk(wordmark, 'h-4') },
        {
          ok: false,
          caption: 'Split, side by side',
          node: (
            <div className="flex items-center gap-6">
              {mk(emblem, 'h-9')}
              {mk(wordmark, 'h-9')}
            </div>
          ),
        },
        {
          ok: false,
          caption: 'Split into zee + foods',
          node: (
            <div className="flex items-center gap-3">
              <div className="overflow-hidden" style={{ width: 31 }}>
                <img src={wordmark} alt="" style={{ width: 88, maxWidth: 'none', display: 'block' }} />
              </div>
              <div className="overflow-hidden" style={{ width: 57 }}>
                <img src={wordmark} alt="" style={{ width: 88, maxWidth: 'none', display: 'block', marginLeft: -31 }} />
              </div>
            </div>
          ),
        },
      ],
    },
    {
      title: 'Placement',
      desc: 'Place the mark at the top-left of the piece, before any text — the emblem on its own, or the full lockup. Never center it, put it on the right, place it after any other text, or set it at the bottom.',
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
          caption: 'After other text',
          node: (
            <div className="flex h-full w-full flex-col gap-2">
              {body(['w-full', 'w-5/6'])}
              <img src={emblem} alt="" className="h-6 w-auto self-start" />
              {body(['w-full', 'w-3/4'])}
            </div>
          ),
        },
        {
          ok: false,
          caption: 'At the bottom',
          node: (
            <div className="flex h-full w-full flex-col gap-2">
              {body(['w-full', 'w-5/6'])}
              <img src={lockup} alt="" className="mt-auto h-4 w-auto self-start" />
            </div>
          ),
        },
      ],
    },
    {
      title: 'Background watermark',
      desc: 'For more official documents, a very faint grey leaf may sit centered behind the content — alongside the mark in its usual top-left spot. Use the leaf alone — never the emblem, lockup, or wordmark — keep it centered, and keep it faint enough never to compete with the text.',
      examples: [
        {
          ok: true,
          caption: 'Faint leaf watermark',
          node: (
            <div className="relative h-full w-full overflow-hidden">
              <img
                src={leafBlack}
                alt=""
                className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-auto -translate-x-1/2 -translate-y-1/2 opacity-[0.12]"
              />
              <div className="relative flex h-full w-full flex-col gap-2">
                <img src={lockup} alt="" className="h-4 w-auto self-start" />
                {body(['w-full', 'w-full', 'w-3/4'])}
              </div>
            </div>
          ),
        },
        {
          ok: false,
          caption: 'The circle emblem',
          node: (
            <div className="relative h-full w-full overflow-hidden">
              <img
                src={emblemBlack}
                alt=""
                className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-auto -translate-x-1/2 -translate-y-1/2 opacity-[0.12]"
              />
              <div className="relative flex h-full w-full flex-col gap-2">
                <img src={lockup} alt="" className="h-4 w-auto self-start" />
                {body(['w-full', 'w-full', 'w-3/4'])}
              </div>
            </div>
          ),
        },
        {
          ok: false,
          caption: 'The lockup or wordmark',
          node: (
            <div className="relative h-full w-full overflow-hidden">
              <img
                src={lockupBlack}
                alt=""
                className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-auto -translate-x-1/2 -translate-y-1/2 opacity-[0.12]"
              />
              <div className="relative flex h-full w-full flex-col gap-2">
                <img src={lockup} alt="" className="h-4 w-auto self-start" />
                {body(['w-full', 'w-full', 'w-3/4'])}
              </div>
            </div>
          ),
        },
        {
          ok: false,
          caption: 'Off-center',
          node: (
            <div className="relative h-full w-full overflow-hidden">
              <img
                src={leafBlack}
                alt=""
                className="pointer-events-none absolute -bottom-3 -right-3 h-20 w-auto opacity-[0.12]"
              />
              <div className="relative flex h-full w-full flex-col gap-2">
                <img src={lockup} alt="" className="h-4 w-auto self-start" />
                {body(['w-full', 'w-full', 'w-3/4'])}
              </div>
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
          {assets.map(({ asset, label, note, variants }) => (
            <BrandAsset key={asset.src} asset={asset} label={label} note={note} variants={variants} />
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
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium tracking-tight">Naming</h2>
          <p className="text-sm text-zinc-600">How to write the name in text — distinct from the logo.</p>
        </div>
        <dl className="overflow-hidden rounded-lg border border-zinc-200">
          {branding.naming.forms.map((f, i) => (
            <div
              key={f.name}
              className={`flex flex-col gap-0.5 p-4 sm:flex-row sm:items-baseline sm:gap-4 ${
                i > 0 ? 'border-t border-zinc-200' : ''
              }`}
            >
              <dt className="font-mono text-sm font-medium text-brand-blue sm:w-44 sm:shrink-0">{f.name}</dt>
              <dd className="text-sm text-zinc-600">{f.use}</dd>
            </div>
          ))}
        </dl>
      </section>

      {cases.map((c) => (
        <section key={c.title} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-medium tracking-tight">{c.title}</h2>
            <p className="max-w-3xl text-sm text-zinc-600">{c.desc}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {c.examples.map((ex, i) => (
              <UsageExample key={`${c.title}-${i}`} ok={ex.ok} caption={ex.caption} ground={ex.ground}>
                {ex.node}
              </UsageExample>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
