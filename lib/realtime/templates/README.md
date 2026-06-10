# Realtime SQL templates (D7 / ADR-0002)

These two `.sql` files are **inert documentation**, not migrations. They are the
canonical shape of the per-domain realtime plumbing described in ADR-0002. A
feature instantiates them into its own migration when it wants to stream a table
to clients; they are never applied from this directory. Executable verification
(does the trigger fire? does the policy gate correctly?) arrives with that
feature's live integration test — until a feature instantiates them, there is
nothing to run here.

## What each template does

### `broadcast-trigger.sql`

An `AFTER INSERT OR UPDATE OR DELETE` row trigger on the streamed table. For each
changed row it calls `realtime.broadcast_changes` twice:

- `{domain}:{owner_id}` — the row owner's private per-user channel, where
  `owner_id` is `coalesce(NEW.created_by, OLD.created_by)`.
- `{domain}:all` — the owner firehose.

The function is `SECURITY DEFINER` with a pinned `search_path`, and the whole
script is guarded by an `IF EXISTS (... schema_name = 'realtime')` check so it is
a no-op on a database without the Supabase `realtime` schema.

### `realtime-messages-policy.sql`

A `PERMISSIVE ... FOR SELECT TO authenticated` policy on `realtime.messages` —
the **channel layer**, which is where delivery is gated. A subscriber may read:

- their own `{domain}:{auth.uid()}` topic; or
- `{domain}:all`, but only if their own `public.profiles` row has
  `role = 'owner'`. The `EXISTS` reads the subscriber's *own* profiles row, which
  `profiles_select_self` already permits, so there is no policy recursion.

## Placeholders

| Placeholder | Meaning                                              | Example   |
| ----------- | --------------------------------------------------- | --------- |
| `$DOMAIN`   | Topic prefix / domain name (also names the fn, trigger, and policy) | `notes`   |
| `$TABLE`    | The streamed table in `public` the trigger attaches to             | `notes`   |

`$TABLE` appears only in `broadcast-trigger.sql`; `realtime-messages-policy.sql`
uses `$DOMAIN` alone.

## Instantiation workflow

1. **Generate** an empty custom migration:
   `npm run db:generate -- --custom` (drizzle-kit generate --custom).
2. **Paste** the contents of both templates into the generated `.sql` file.
3. **Replace** every `$DOMAIN` and `$TABLE` with the feature's concrete values.
4. **Migrate**: `npm run db:migrate`.
5. Add the feature's live integration test asserting the trigger broadcasts and
   the policy gates per-user.

## The rule

Streamed tables keep **only** their `app_user` ownership policies (the ordinary
row-RLS that decides who may read/write the rows directly). Delivery filtering
for realtime lives **exclusively** in the `realtime.messages` policy above —
never add row-RLS to a table for the purpose of filtering what gets streamed.
This separation is the whole point of ADR-0002.
