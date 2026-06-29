'use client';

// One brand mark, presented as a card: a preview, a colorway selector
// (Color / Black / White), and a download link. Picking a colorway updates the
// preview (and flips the panel to dark for reversed/white marks) and points the
// download at that file. Client component for the selection state; asset + colorway
// data arrive via props — never hardcoded (Charter D8).

import { useState } from 'react';

export type BrandAssetData = { src: string; alt: string; width: number; height: number };

export type AssetVariant = { label: string; src: string };

export function BrandAsset({
  asset,
  label,
  note,
  variants,
}: {
  asset: BrandAssetData;
  label: string;
  note?: string;
  variants: AssetVariant[];
}) {
  const [active, setActive] = useState(0);
  const selected = variants[active] ?? variants[0];
  const filename = selected.src.replace(/^\//, '').split('?')[0];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4">
      {/* A neutral mid-grey panel: the brand colors, the one-color black, and the
          reversed white mark all read against it — so every colorway previews on
          one background. */}
      <div className="flex h-20 items-center justify-center rounded bg-zinc-500">
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG brand asset; next/image adds nothing for an unoptimizable vector */}
        <img src={selected.src} alt={asset.alt} className="max-h-14 w-auto" />
      </div>

      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-xs text-zinc-500">{filename}</span>
        {note ? <span className="mt-0.5 text-xs text-zinc-500">{note}</span> : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div
          className="inline-flex overflow-hidden rounded border border-zinc-200"
          role="group"
          aria-label={`${label} colorway`}
        >
          {variants.map((v, i) => (
            <button
              key={v.label}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                i === active
                  ? 'bg-brand-blue text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-50'
              } ${i > 0 ? 'border-l border-zinc-200' : ''}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <a
          href={selected.src}
          download={filename}
          className="text-sm font-medium text-brand-blue underline"
        >
          Download
        </a>
      </div>
    </div>
  );
}
