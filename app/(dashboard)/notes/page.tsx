import { createNote, getNotes, NotesLive } from '@/app/_features/notes';
import { getSessionUser } from '@/lib/auth/session';

/**
 * The notes page — an all-authed-users surface (the nav entry is ungated). It
 * server-renders the caller's visible notes (own rows for a member, all rows for
 * an owner — scoped by `getNotes`' CASL + RLS) and hands them to `NotesLive`,
 * which keeps the list live via the per-user broadcast topic.
 *
 * Auth is the proxy's job (Task 23); by the time this renders a session exists,
 * so `session!.userId` is safe — `getNotes` would itself fail closed otherwise.
 * Dates are serialized to ISO strings HERE, at the RSC boundary, so the client
 * island works in a single string shape for both the seed and live rows.
 *
 * The page itself (form wiring + the create round-trip) is covered by the notes
 * E2E suite rather than a unit test for this async server component — the same
 * recorded deviation the activity page makes.
 */
export default async function NotesPage() {
  const session = await getSessionUser();
  const rows = (await getNotes()).map((n) => ({
    id: n.id,
    createdBy: n.createdBy,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
      <form action={createNote} className="flex gap-2">
        <input
          name="body"
          required
          aria-label="Note body"
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          New note
        </button>
      </form>
      <NotesLive userId={session!.userId} initial={rows} />
    </div>
  );
}
