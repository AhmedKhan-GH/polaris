import pg from 'pg';

/**
 * DEV-ONLY dummy notes: a handful of cold-chain notes so the notes editor has
 * real content — nav entries, titles, and a couple with edit HISTORY (multiple
 * versions) to exercise the history panel + restore. Library-only; the umbrella
 * `db:seed-dev` calls it alongside the demo users and dummy catalog.
 *
 * Each note is inserted as the versioned shape it really has: a `notes` row (the
 * current title/body projection) plus its `note_versions` chain (seq 1..n). Fixed
 * UUIDs make it idempotent — re-running conflicts on `notes.id` and on
 * `(note_id, seq)` and does nothing. Runs under the privileged role (bypasses RLS).
 */
type Version = { body: string; at: string };
type SeedNote = { id: string; author: 'owner' | 'member'; title: string; versions: Version[] };

const SEED_NOTES: SeedNote[] = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    author: 'owner',
    title: 'Reefer R-07 — daily check',
    versions: [
      { body: 'Pre-cool started on R-07; target −18°C.', at: '2026-06-28T06:00:00Z' },
      {
        body: 'R-07 holding −18.2°C, within spec. Pre-cool complete; cleared for loading.',
        at: '2026-06-28T08:30:00Z',
      },
    ],
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    author: 'owner',
    title: 'Carrier swap — LHE→DXB',
    versions: [
      { body: 'Evaluating a carrier swap on lane LHE→DXB after two late arrivals.', at: '2026-06-29T14:00:00Z' },
      {
        body: 'Carrier swap approved for lane LHE→DXB, effective next cycle. Ops notified.',
        at: '2026-06-29T16:20:00Z',
      },
    ],
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    author: 'member',
    title: 'Dock 3 — audit note',
    versions: [
      { body: 'Dock 3 door open 14 min during load — logged for the temperature audit.', at: '2026-06-29T11:51:00Z' },
    ],
  },
  {
    id: 'a0000000-0000-4000-8000-000000000004',
    author: 'member',
    title: 'SLA watch — SH-4471',
    versions: [
      { body: 'SLA risk flagged on SH-4471 — customs dwell +40 min. Watching the ETA.', at: '2026-06-30T09:15:00Z' },
    ],
  },
  {
    id: 'a0000000-0000-4000-8000-000000000005',
    author: 'owner',
    title: 'Cold-chain compliance — Q3',
    versions: [
      { body: 'Quarterly cold-chain compliance review scheduled for Jul 15. Prep the reefer logs.', at: '2026-06-30T10:00:00Z' },
    ],
  },
];

/**
 * Seed the dummy notes under the privileged role, attributing each to the owner
 * or member seed account, and return the resulting `notes` count. Idempotent.
 */
export async function seedDummyNotes(
  adminUrl: string,
  ownerId: string,
  memberId: string,
): Promise<number> {
  const pool = new pg.Pool({ connectionString: adminUrl });
  try {
    for (const n of SEED_NOTES) {
      const createdBy = n.author === 'owner' ? ownerId : memberId;
      const latest = n.versions[n.versions.length - 1]!;
      // `notes` projection: current title/body, timestamped at the latest edit so
      // the nav orders by recent activity and the editor's "edited" time is right.
      await pool.query(
        `insert into notes (id, created_by, title, body, created_at)
           values ($1, $2, $3, $4, $5) on conflict (id) do nothing`,
        [n.id, createdBy, n.title, latest.body, latest.at],
      );
      for (let i = 0; i < n.versions.length; i += 1) {
        const v = n.versions[i]!;
        await pool.query(
          `insert into note_versions (note_id, seq, title, body, edited_by, created_at)
             values ($1, $2, $3, $4, $5, $6) on conflict (note_id, seq) do nothing`,
          [n.id, i + 1, n.title, v.body, createdBy, v.at],
        );
      }
    }
    const { rows } = await pool.query('select count(*)::int as n from notes');
    return rows[0].n as number;
  } finally {
    await pool.end();
  }
}
