/**
 * Normalize a typed dollar string into a fixed two-decimal money string the way
 * financial inputs do on blur: `'12'` → `'12.00'`, `'12.5'` → `'12.50'`,
 * `'12.999'` → `'13.00'`. The value is rounded to the nearest cent with the SAME
 * arithmetic the server uses to store it (`Math.round(dollars * 100)`), so the
 * box always displays exactly what will be persisted.
 *
 * Returns `null` for a blank or non-numeric entry so the caller can leave the
 * field untouched — required-field handling stays at the call site.
 */
export function normalizeDollarInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return (Math.round(n * 100) / 100).toFixed(2);
}
