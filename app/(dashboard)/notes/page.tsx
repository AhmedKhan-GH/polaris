import { getNotes, NotesView } from '@/app/_features/notes';
import { getSessionUser } from '@/lib/auth/session';
import { getPreferences } from '@/lib/preferences';

/**
 * The Notes page — an all-authed-users surface. Server-driven: `?note=` selects a
 * note to read (defaulting to the newest), `?new` opens the one-shot create form.
 * Notes are immutable, so there is no edit/history state. It loads the caller's
 * visible notes (RLS-scoped by `getNotes`) and hands them to `NotesView`.
 *
 * Auth is the proxy's job; a session exists by the time this renders, so
 * `session!.userId` is safe. Covered by the notes E2E suite rather than a unit
 * test for this async server component (the recorded activity-page deviation).
 */
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string; new?: string }>;
}) {
  const session = await getSessionUser();
  const { note, new: creatingParam } = await searchParams;
  const notes = await getNotes();

  const selectedId = notes.some((n) => n.id === note) ? note! : (notes[0]?.id ?? null);
  const { timezone, hour12 } = await getPreferences();

  return (
    <NotesView
      notes={notes}
      selectedId={selectedId}
      creating={Boolean(creatingParam)}
      currentUserId={session!.userId}
      timezone={timezone}
      hour12={hour12}
    />
  );
}
