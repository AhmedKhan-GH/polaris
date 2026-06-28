// @vitest-environment node
//
// The shared timestamp formatter (foundation). Pure (epoch-ms, IANA zone, 12/24h)
// → 'YYYY-MM-DD · HH:MM:SS' (+ AM/PM in 12h). Every feature that renders a time
// formats through this; the user's zone/clock arrive from getPreferences() (D3).

import { describe, expect, it } from 'vitest';

import { formatTimestamp, listTimeZones } from '@/lib/datetime';

// Fixed instants (epoch ms), so the expectations don't depend on "now".
const WINTER = Date.UTC(2026, 0, 15, 12, 30, 45); // 2026-01-15 12:30:45 UTC (EST in NY)
const SUMMER = Date.UTC(2026, 6, 15, 12, 0, 0); //  2026-07-15 12:00:00 UTC (EDT in NY)
const MIDNIGHT = Date.UTC(2026, 0, 15, 0, 0, 0);
const NOON = Date.UTC(2026, 0, 15, 12, 0, 0);

describe('formatTimestamp', () => {
  it('renders the instant in the supplied zone (UTC)', () => {
    expect(formatTimestamp(WINTER, 'UTC', false)).toBe('2026-01-15 · 12:30:45');
  });

  it('shifts wall-clock time into the supplied zone', () => {
    // EST = UTC-5 in January → 12:30 UTC reads 07:30 local.
    expect(formatTimestamp(WINTER, 'America/New_York', false)).toBe(
      '2026-01-15 · 07:30:45',
    );
  });

  it('honors DST — the same zone shifts an hour in summer', () => {
    // EDT = UTC-4 in July → 12:00 UTC reads 08:00 local.
    expect(formatTimestamp(SUMMER, 'America/New_York', false)).toBe(
      '2026-07-15 · 08:00:00',
    );
  });

  it('24h (h23): midnight reads 00, not 24', () => {
    expect(formatTimestamp(MIDNIGHT, 'UTC', false)).toBe('2026-01-15 · 00:00:00');
  });

  it('12h: midnight is 12:00:00 AM', () => {
    expect(formatTimestamp(MIDNIGHT, 'UTC', true)).toBe('2026-01-15 · 12:00:00 AM');
  });

  it('12h: noon is 12:00:00 PM', () => {
    expect(formatTimestamp(NOON, 'UTC', true)).toBe('2026-01-15 · 12:00:00 PM');
  });

  it('defaults to 24h when hour12 is omitted', () => {
    expect(formatTimestamp(NOON, 'UTC')).toBe('2026-01-15 · 12:00:00');
  });
});

describe('listTimeZones', () => {
  it('returns a non-empty IANA list', () => {
    expect(listTimeZones().length).toBeGreaterThan(0);
  });

  it('always offers UTC (the default) and real zones', () => {
    const zones = listTimeZones();
    expect(zones).toContain('UTC');
    expect(zones).toContain('America/New_York');
  });
});
