// One downloadable brand file, presented as a card: a preview, its label and
// filename, an optional usage note, and a download link to the raw SVG (served
// statically from /public). Server component; the asset comes in via props —
// never hardcoded (Charter D8).

export type BrandAssetData = { src: string; alt: string; width: number; height: number };

export function BrandAsset({
  asset,
  label,
  note,
  preview = 'light',
}: {
  asset: BrandAssetData;
  label: string;
  note?: string;
  preview?: 'light' | 'dark';
}) {
  const filename = asset.src.replace(/^\//, '').split('?')[0];
  // A dark panel for light / knockout marks — a white leaf or a transparent
  // cutout would be invisible (or indistinguishable from the logo) on white.
  const panel = preview === 'dark' ? 'bg-slate-800' : 'bg-white';

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4">
      <div
        data-preview={preview}
        className={`flex h-20 items-center justify-center rounded ${panel}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG brand asset; next/image adds nothing for an unoptimizable vector */}
        <img src={asset.src} alt={asset.alt} width={asset.width} height={asset.height} className="max-h-14 w-auto" />
      </div>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{label}</span>
          <span className="font-mono text-xs text-zinc-500">{filename}</span>
          {note ? <span className="mt-0.5 text-xs text-zinc-500">{note}</span> : null}
        </div>
        <a href={asset.src} download={filename} className="text-sm font-medium text-brand-blue underline">
          Download
        </a>
      </div>
    </div>
  );
}
