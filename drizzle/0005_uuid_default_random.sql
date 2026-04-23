-- Move UUID generation from the client to the database. The server
-- action no longer passes an id; Postgres mints one via
-- gen_random_uuid() on insert. Existing rows are unaffected.

ALTER TABLE "orders" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
