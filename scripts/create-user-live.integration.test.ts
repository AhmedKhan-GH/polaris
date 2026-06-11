import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { isLiveDbReachable, LIVE_DB, liveDbGate } from '@/lib/db/__tests__/live-db';

import { createUser } from './db-setup';

/**
 * The live-stack contract for createUser() — the core scripts/create-user.ts
 * drives, replacing the README's manual "curl GoTrue admin API + psql upsert"
 * dance. GoTrue exists only on the real stack, so this suite reaches
 * `:54321`/`:54322` directly and gates on reachability like the other live
 * suites. The fixture account is DELETED first so a do-nothing implementation
 * can't look green on leftover state.
 */
const reachable = await isLiveDbReachable();
const mode = liveDbGate(reachable, !!process.env.CI_REQUIRE_LIVE_DB);

// Committed local demo values — same constants as db-setup-live.integration.
const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const EMAIL = 'created-by-script@example.com';
const PASSWORD = 'script-password-123';
const ROLE = 'owner';

(mode === 'run' ? describe : describe.skip)(
  'createUser provisions one login-able account on the live stack',
  () => {
    let admin: pg.Client;
    let returnedId: string;

    beforeAll(async () => {
      admin = new pg.Client({ connectionString: LIVE_DB });
      await admin.connect();
      await admin.query('delete from public.profiles where email = $1', [EMAIL]);
      await admin.query('delete from auth.users where email = $1', [EMAIL]);

      returnedId = await createUser({
        adminUrl: LIVE_DB,
        supabaseUrl: SUPABASE_URL,
        serviceKey: SERVICE_ROLE_KEY,
        email: EMAIL,
        password: PASSWORD,
        role: ROLE,
      });
    });

    afterAll(async () => {
      await admin.query('delete from public.profiles where email = $1', [EMAIL]);
      await admin.query('delete from auth.users where email = $1', [EMAIL]);
      await admin.end();
    });

    it('returns the GoTrue user id it created', async () => {
      const { rows } = await admin.query(
        'select id from auth.users where email = $1',
        [EMAIL],
      );
      expect(rows).toHaveLength(1);
      expect(returnedId).toBe(rows[0].id);
    });

    it('mirrors the requested role into profiles', async () => {
      const { rows } = await admin.query(
        'select role from public.profiles where email = $1',
        [EMAIL],
      );
      expect(rows[0].role).toBe(ROLE);
    });

    it('lets the new account actually sign in', async () => {
      const anon = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await anon.auth.signInWithPassword({
        email: EMAIL,
        password: PASSWORD,
      });
      expect(error).toBeNull();
      expect(data.user?.email).toBe(EMAIL);
      await anon.auth.signOut();
    });

    it('is idempotent — re-creating reconciles the role instead of erroring', async () => {
      const secondId = await createUser({
        adminUrl: LIVE_DB,
        supabaseUrl: SUPABASE_URL,
        serviceKey: SERVICE_ROLE_KEY,
        email: EMAIL,
        password: PASSWORD,
        role: 'member',
      });
      expect(secondId).toBe(returnedId);
      const { rows } = await admin.query(
        'select role from public.profiles where email = $1',
        [EMAIL],
      );
      expect(rows[0].role).toBe('member');
    });
  },
);
