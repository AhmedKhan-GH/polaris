import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  isLiveDbReachable,
  LIVE_DB,
  liveDbGate,
} from '@/lib/db/__tests__/live-db';

import { seedDemoUsers } from './db-setup';

/**
 * The live-stack half of the `db:setup` contract: a clean build must end with
 * accounts someone can actually log in with. GoTrue exists only on the real
 * stack (the testcontainer half of the contract lives in
 * db-setup.integration.test.ts), so this suite reaches `:54321`/`:54322`
 * directly and gates on reachability exactly like the realtime/profiles
 * live suites.
 *
 * Before seeding, the three demo users are DELETED — without that, state left
 * by any earlier e2e run would make a do-nothing seeder look green; deleting
 * first proves `seedDemoUsers` itself creates them.
 */
const reachable = await isLiveDbReachable();
const mode = liveDbGate(reachable, !!process.env.CI_REQUIRE_LIVE_DB);

// Committed local demo values — same constants as .env.test, hardcoded the
// way live-db.ts hardcodes LIVE_DB (the integration vitest config injects a
// fake anon key, so the env vars are not usable here).
const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const PASSWORD = 'test-password-123';
const EMAILS = ['owner@example.com', 'member@example.com', 'admin@example.com'];

(mode === 'run' ? describe : describe.skip)(
  'db:setup seeds login-able demo users on the live stack',
  () => {
    let admin: pg.Client;

    beforeAll(async () => {
      admin = new pg.Client({ connectionString: LIVE_DB });
      await admin.connect();
      // Force the clean-build state for exactly these two fixtures.
      await admin.query('delete from public.profiles where email = any($1)', [
        EMAILS,
      ]);
      await admin.query('delete from auth.users where email = any($1)', [
        EMAILS,
      ]);

      await seedDemoUsers({
        adminUrl: LIVE_DB,
        supabaseUrl: SUPABASE_URL,
        serviceKey: SERVICE_ROLE_KEY,
        password: PASSWORD,
      });
    });

    afterAll(async () => {
      await admin.end();
    });

    it('creates all three GoTrue users', async () => {
      const { rows } = await admin.query(
        'select count(*)::int as n from auth.users where email = any($1)',
        [EMAILS],
      );
      expect(rows[0].n).toBe(3);
    });

    it('mirrors their roles into profiles (owner/member/admin)', async () => {
      const { rows } = await admin.query(
        'select email, role from public.profiles where email = any($1) order by email',
        [EMAILS],
      );
      expect(rows).toEqual([
        { email: 'admin@example.com', role: 'admin' },
        { email: 'member@example.com', role: 'member' },
        { email: 'owner@example.com', role: 'owner' },
      ]);
    });

    it('lets owner@example.com actually sign in (the clean-build promise)', async () => {
      const anon = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await anon.auth.signInWithPassword({
        email: 'owner@example.com',
        password: PASSWORD,
      });
      expect(error).toBeNull();
      expect(data.user?.email).toBe('owner@example.com');
      await anon.auth.signOut();
    });

    it('is idempotent — re-seeding reconciles instead of erroring or duplicating', async () => {
      await seedDemoUsers({
        adminUrl: LIVE_DB,
        supabaseUrl: SUPABASE_URL,
        serviceKey: SERVICE_ROLE_KEY,
        password: PASSWORD,
      });
      const { rows } = await admin.query(
        'select count(*)::int as n from auth.users where email = any($1)',
        [EMAILS],
      );
      expect(rows[0].n).toBe(3);
    });
  },
);
