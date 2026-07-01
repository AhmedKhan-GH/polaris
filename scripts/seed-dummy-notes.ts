import pg from 'pg';

/**
 * DEV-ONLY dummy notes: a handful of cold-chain notes so the notes surface has
 * real content — nav entries + titles to read. Library-only; the umbrella
 * `db:seed-dev` calls it alongside the demo users and dummy catalog.
 *
 * Notes are immutable (write-once), so each is a single `notes` row. Fixed UUIDs
 * make it idempotent — re-running conflicts on `notes.id` and does nothing. Runs
 * under the privileged role (bypasses RLS), split across the owner/member accounts.
 */
type SeedNote = { id: string; author: 'owner' | 'member'; title: string; body: string; at: string };

const SEED_NOTES: SeedNote[] = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    author: 'owner',
    title: 'Reefer R-07 — daily check',
    body: 'R-07 holding −18.2°C, within spec. Pre-cool complete; cleared for loading.',
    at: '2026-06-28T08:30:00Z',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    author: 'owner',
    title: 'Carrier swap — LHE→DXB',
    body: 'Carrier swap approved for lane LHE→DXB, effective next cycle. Ops notified.',
    at: '2026-06-29T16:20:00Z',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    author: 'member',
    title: 'Dock 3 — audit note',
    body: 'Dock 3 door open 14 min during load — logged for the temperature audit.',
    at: '2026-06-29T11:51:00Z',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000004',
    author: 'member',
    title: 'SLA watch — SH-4471',
    body: 'SLA risk flagged on SH-4471 — customs dwell +40 min. Watching the ETA.',
    at: '2026-06-30T09:15:00Z',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000005',
    author: 'owner',
    title: 'Cold-chain compliance — Q3',
    body: 'Quarterly cold-chain compliance review scheduled for Jul 15. Prep the reefer logs.',
    at: '2026-06-30T10:00:00Z',
  },
];

/**
 * Seed the dummy notes under the privileged role, attributing each to the owner or
 * member seed account, and return the resulting `notes` count. Idempotent.
 */
export async function seedDummyNotes(
  adminUrl: string,
  ownerId: string,
  memberId: string,
): Promise<number> {
  const pool = new pg.Pool({ connectionString: adminUrl });
  try {
    for (const n of SEED_NOTES) {
      await pool.query(
        `insert into notes (id, created_by, title, body, created_at)
           values ($1, $2, $3, $4, $5) on conflict (id) do nothing`,
        [n.id, n.author === 'owner' ? ownerId : memberId, n.title, n.body, n.at],
      );
    }
    const { rows } = await pool.query('select count(*)::int as n from notes');
    return rows[0].n as number;
  } finally {
    await pool.end();
  }
}
