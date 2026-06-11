import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Build-time / CLI-only config (Charter D1 exception). Loaded by drizzle-kit,
// never by running application code, so it reads `process.env` directly rather
// than the validated `lib/env` module. `MIGRATE_DATABASE_URL` (the privileged
// migrate role) is consumed only here; the app falls back to `DATABASE_URL`.
config({ path: '.env.local' });

export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './lib/db/schema/*.ts',
    './app/_features/*/schema.ts',
    './app/customer/schema.ts',
  ],
  out: './drizzle',
  dbCredentials: {
    url: process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL!,
  },
  entities: { roles: true },
});
