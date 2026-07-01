/**
 * Notes dev API (Iron Rule 8, ADR-0005) — the ONLY surface outsiders may
 * import; the boundary law (rule D) fails the build on anything deeper.
 * Exactly what the route page consumes, one deliberate export per line.
 * NOT exported on purpose: `use-notes-realtime.ts` (private plumbing of
 * NotesLive) and the manifests `schema`/`permissions`/`nav` (the registry's
 * seam, rule C — never re-export manifests through the index).
 */
export { NotesView } from './NotesView';
export { getNotes, createNote } from './actions';
export type { NoteRow } from './actions';
