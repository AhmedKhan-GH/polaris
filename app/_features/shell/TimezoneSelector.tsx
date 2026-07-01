'use client';

import { useTransition } from 'react';

import { setPreferences } from './actions';

/**
 * IANA timezone dropdown for the shell top bar (ADR-0009). The `zones` list is
 * computed server-side and passed in as data, so this client component never
 * calls `Intl` itself (no SSR/CSR option-list divergence). On change it sends the
 * chosen zone with the current `hour12` to `setPreferences`, wrapped in a
 * transition that disables the control until the server re-renders.
 */
export function TimezoneSelector({
  timezone,
  hour12,
  zones,
}: {
  timezone: string;
  hour12: boolean;
  zones: string[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label="Time zone"
      value={timezone}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(() => {
          void setPreferences({ timezone: next, hour12 });
        });
      }}
      className="border border-ink-faint bg-surface text-ink px-2 py-1 text-xs disabled:opacity-50"
    >
      {zones.map((zone) => (
        <option key={zone} value={zone}>
          {zone}
        </option>
      ))}
    </select>
  );
}
