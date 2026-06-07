import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

// Load DATABASE_URL from .env.local for local db:migrate/db:generate.
// dotenv won't override vars already set in the environment (e.g. in CI).
config({ path: '.env.local' })

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Manage the restricted `app_user` role declaratively (CREATE ROLE in migrations).
  entities: { roles: true },
})
