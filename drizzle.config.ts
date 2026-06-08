import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

// Load env from .env.local for local db:migrate/db:generate.
// dotenv won't override vars already set in the environment (e.g. in CI).
config({ path: '.env.local' })

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Migrations need the privileged role (CREATE TABLE/POLICY/ROLE/GRANT); the
    // app connects as the non-superuser app_user via DATABASE_URL.
    url: process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL!,
  },
  // Manage the restricted `app_user` role declaratively (CREATE ROLE in migrations).
  entities: { roles: true },
})
