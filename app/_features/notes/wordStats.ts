/**
 * Pure text helper for the notes surface — no DOM, no I/O. Kept pure so the
 * word-count metadata stays a dumb projection of note content.
 */

/** Word count: whitespace-delimited tokens; empty or blank text → 0. */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/** Character count: every character, whitespace included. */
export function charCount(text: string): number {
  return text.length;
}
