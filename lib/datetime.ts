/**
 * Render an epoch-ms instant as 'YYYY-MM-DD · HH:MM:SS' in the supplied IANA
 * timezone (+ AM/PM in 12h mode). Uses Intl.DateTimeFormat.formatToParts so the
 * output is stable across locales (no comma/space drift) and pieces are read by
 * part name rather than position. 24h mode pins hourCycle 'h23' so midnight reads
 * '00' rather than '24'; 12h mode pins 'h12' and appends the day-period marker.
 *
 * Foundation, deliberately: every feature that renders a timestamp formats through
 * this, with the user's zone + clock supplied by getPreferences() (D3) — see
 * ADR-0009. It never reads a preference itself; it is a pure function.
 */
export function formatTimestamp(
  ms: number,
  timeZone: string,
  hour12 = false,
): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: hour12 ? 'h12' : 'h23',
  }).formatToParts(new Date(ms));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const time = `${get('hour')}:${get('minute')}:${get('second')}`;
  const period = hour12 ? ` ${get('dayPeriod')}` : '';
  return `${date} · ${time}${period}`;
}

const FALLBACK_TIME_ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

/**
 * The IANA zones the selector offers. Prefers the runtime's full list
 * (`Intl.supportedValuesOf`, hundreds of zones); falls back to a small anchor set
 * on runtimes that lack it, so the dropdown is never empty. `UTC` is guaranteed
 * present — it is the default preference and must always be selectable, even
 * though some runtimes omit it from the supported list. Called server-side so the
 * options reach the client component as data (no SSR/CSR `Intl` divergence).
 */
export function listTimeZones(): string[] {
  const supported = (
    Intl as { supportedValuesOf?: (key: 'timeZone') => string[] }
  ).supportedValuesOf;
  const zones = supported ? supported('timeZone') : FALLBACK_TIME_ZONES;
  return zones.includes('UTC') ? zones : ['UTC', ...zones];
}

