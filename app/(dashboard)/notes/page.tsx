import { createNote, getNotes, NotesLive } from '@/app/_features/notes';
import { getSessionUser } from '@/lib/auth/session';
import { getPreferences } from '@/lib/preferences';

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
  const { timezone, hour12 } = await getPreferences();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Operations
        </p>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Notes</h1>
      </div>
      <form action={createNote} className="flex gap-2">
        <input
          name="body"
          required
          aria-label="Note body"
          placeholder="Add a note…"
          className="flex-1 border border-hairline-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          className="bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
        >
          Add note
        </button>
      </form>
      <NotesLive
        userId={session!.userId}
        initial={rows}
        timezone={timezone}
        hour12={hour12}
      />
    </div>
  );
}
