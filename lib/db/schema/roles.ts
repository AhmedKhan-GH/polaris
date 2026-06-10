import { pgRole } from 'drizzle-orm/pg-core';

/**
 * The non-superuser runtime role the application connects as. Declared in the
 * schema so drizzle-kit emits `CREATE ROLE "app_user"` in the migration; LOGIN
 * and password are environment concerns applied outside migrations.
 */
export const appUser = pgRole('app_user');
