import { drizzle } from 'drizzle-orm/node-postgres';

import { env } from '@/lib/env';

import * as schema from './schema';

/**
 * The application database handle. Connects as the non-superuser app role via
 * the validated `DATABASE_URL`, so RLS policies apply to every query made
 * through it. Migrations run separately under the privileged migrate role.
 */
export const db = drizzle(env.DATABASE_URL, { schema });
