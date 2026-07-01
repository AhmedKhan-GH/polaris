import { contrastRatio } from './contrast';
import type { StatusMarker } from './palette';

/** The status marker as it actually appears in the app: a soft fill + colored text + dot. */
function Chip({ label, text, bg }: { label: string; text: string; bg: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-medium"
      style={{ backgroundColor: bg, color: text, borderColor: `${text}33` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: text }} aria-hidden />
      {label}
    </span>
  );
}

/**
 * One status marker, shown as the real chip in both themes with the measured AA
 * ratios. Status hues encode DATA state (temperature in/out of range, SLA at
 * risk) — never chrome — so they only ever appear like this, keeping the single
 * action color unambiguous. Server component.
 */
export function StatusSwatch({ marker }: { marker: StatusMarker }) {
  const aaLight = contrastRatio(marker.light, marker.lightSoft);
  const aaDark = contrastRatio(marker.dark, marker.darkSoft);
  return (
    <div className="flex flex-col gap-2 border border-hairline p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink">{marker.name}</span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
          {marker.meaning}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip label={marker.meaning} text={marker.light} bg={marker.lightSoft} />
        <Chip label={marker.meaning} text={marker.dark} bg={marker.darkSoft} />
      </div>
      <span className="text-xs text-ink-faint">{marker.role}</span>
      <span className="font-mono text-[11px] text-ink-muted">
        AA {aaLight.toFixed(1)}:1 · {aaDark.toFixed(1)}:1
      </span>
    </div>
  );
}
