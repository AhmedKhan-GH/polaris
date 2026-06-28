// The corrected logo proportions, presented as a small table. Server component;
// it formats the already-computed ratios (it does no math of its own).

import { Fragment } from 'react';

import type { LogoRatios as LogoRatiosData } from './ratios';

/** "2.80 : 1" for non-whole ratios, "1 : 1" for whole ones (the circular emblem). */
function formatAspect(n: number): string {
  const rounded = Math.round(n);
  const whole = Math.abs(n - rounded) < 1e-6;
  return `${whole ? rounded : n.toFixed(2)} : 1`;
}

const formatPct = (n: number) => `${Math.round(n * 100)}%`;

export function LogoRatios({ ratios }: { ratios: LogoRatiosData }) {
  const rows = [
    { label: 'Full lockup', value: formatAspect(ratios.lockupAspect) },
    { label: 'Emblem', value: formatAspect(ratios.emblemAspect) },
    { label: 'Emblem width of lockup', value: formatPct(ratios.emblemWidthPct) },
    { label: 'Emblem height of lockup', value: formatPct(ratios.emblemHeightPct) },
  ];

  return (
    <div className="flex flex-col gap-2">
      <dl className="grid w-max grid-cols-[auto_auto] gap-x-8 gap-y-1 text-sm">
        {rows.map((row) => (
          <Fragment key={row.label}>
            <dt className="text-zinc-600">{row.label}</dt>
            <dd className="font-mono">{row.value}</dd>
          </Fragment>
        ))}
      </dl>
      <p className="text-xs text-zinc-500">
        Emblem corrected from {formatAspect(ratios.correction.sourceEmblemAspect)} (source) to a
        true circle.
      </p>
    </div>
  );
}
