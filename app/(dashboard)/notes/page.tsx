import { getNoteHistory, getNotes, NotesEditor } from '@/app/_features/notes';
import { getSessionUser } from '@/lib/auth/session';
import { getPreferences } from '@/lib/preferences';

/**
 * The Notes editor page — an all-authed-users surface. Server-driven: the
 * selected note is the `?note=` URL param (defaulting to the newest), so
 * navigation, save, and restore all work through RSC + server actions with no
 * client store. It loads the caller's visible notes (RLS-scoped by `getNotes`)
 * and the selected note's version history, and hands them to `NotesEditor`.
 *
 * Auth is the proxy's job; a session exists by the time this renders, so
 * `session!.userId` is safe. Covered by the notes E2E suite rather than a unit
 * test for this async server component (the recorded activity-page deviation).
 */
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string; v?: string }>;
}) {
  const session = await getSessionUser();
  const { note, v } = await searchParams;
  const notes = await getNotes();

  // Selection: the requested note if it's one the caller can see, else the newest.
  const selectedId = notes.some((n) => n.id === note) ? note! : (notes[0]?.id ?? null);
  const history = selectedId ? await getNoteHistory(selectedId) : [];
  const { timezone, hour12 } = await getPreferences();

  return (
    <NotesEditor
      notes={notes}
      selectedId={selectedId}
      history={history}
      viewedVersionId={v ?? null}
      currentUserId={session!.userId}
      timezone={timezone}
      hour12={hour12}
    />
  );
}
