# Row Level Security Plan

## Phase 1: Base RLS (now)

Close the open REST API. Every table gets a blanket policy that requires an authenticated user. No roles, no granularity — just a gate.

### Tables

| Table | Policy | Effect |
|-------|--------|--------|
| `orders` | `auth.uid() IS NOT NULL` | Any logged-in user can CRUD |
| `order_status_history` | `auth.uid() IS NOT NULL` | Any logged-in user can read/write |
| `order_status_counts` | `auth.uid() IS NOT NULL` | Any logged-in user can read |

### What this solves

- Unauthenticated users can no longer query the Supabase REST API directly with just the anon key
- The app behavior stays exactly the same — all authenticated users still have full access

### What this doesn't solve

- Any authenticated user can see and modify everything
- No role-based restrictions
- No data isolation between users

### Migration

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access" ON orders
  FOR ALL USING (auth.uid() IS NOT NULL);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access" ON order_status_history
  FOR ALL USING (auth.uid() IS NOT NULL);

ALTER TABLE order_status_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access" ON order_status_counts
  FOR ALL USING (auth.uid() IS NOT NULL);
```

---

## Phase 2: Owner onboarding (minimal org structure)

Introduce just enough structure for the System user to create an Owner through the app.

### Scope

- `user_role` enum with all roles defined (future-proof)
- `profiles` table with role column
- `invites` table (single-use codes)
- One server action: generate an invite code for the `owner` role
- One public registration page: redeem code, pick email + password
- Auto-create profile trigger on `auth.users` insert

Admin, Member, and Guest onboarding are deferred — the enum and tables support them, but no UI or server actions are built for those tiers yet.

### Schema changes

**`user_role` enum:**

```sql
CREATE TYPE user_role AS ENUM ('system', 'owner', 'admin', 'member', 'guest');
```

**`profiles` table:**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID, PK | References `auth.users(id)` |
| `role` | `user_role` | User's role, default `member` |
| `created_at` | BIGINT | Epoch ms |

**Auto-create trigger:**

When a new user is created in `auth.users`, a trigger inserts a row into `profiles` with the default role (`member`). The System user's profile is manually set to `system` after the out-of-band creation.

**Custom access token hook:**

A Postgres function that injects `user_role` into the JWT on every token issue. This makes the role available in RLS policies via `auth.jwt() ->> 'user_role'` without joining `profiles` on every query.

### Invites table

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID, PK | |
| `code` | TEXT, unique | Short alphanumeric code (e.g., `AX7K-29MR`) |
| `role` | `user_role` | Role assigned on redemption |
| `created_by` | UUID | Auth user who generated the invite |
| `used_at` | BIGINT, nullable | Epoch ms when redeemed |
| `expires_at` | BIGINT | Epoch ms expiration |

Invite codes are single-use. On redemption, the server creates the auth user, and the trigger creates the profile with the default role. The server action then updates the profile role to match the invite.

### App changes

1. **System-only invite page** — generates an `owner` invite code, displays it on screen
2. **Public registration page** (`/register`) — accepts code + email + password, redeems the invite
3. **Proxy update** — add `/register` to public routes

### What's deferred

- Owner creating Admin invites (same flow, different role — add later)
- Admin creating Member invites (same flow, different role — add later)
- Guest self-registration (different flow — add later)
- Role-based UI restrictions (all users see the same UI for now)

---

## Phase 3: Role-based RLS

Replace the blanket policies with role-aware rules. Policies read the role from the JWT — no joins needed.

### `orders`

| Operation | System | Owner | Admin | Member | Guest |
|-----------|--------|-------|-------|--------|-------|
| SELECT | all | all | all | all | own only |
| INSERT | yes | yes | yes | yes | own only |
| UPDATE | yes | yes | yes | assigned | no |
| DELETE | yes | yes | no | no | no |

### `order_status_history`

| Operation | System | Owner | Admin | Member | Guest |
|-----------|--------|-------|-------|--------|-------|
| SELECT | all | all | all | all | own orders |
| INSERT | via trigger | via trigger | via trigger | via trigger | no |

### `order_status_counts`

| Operation | All roles |
|-----------|-----------|
| SELECT | yes |
| INSERT/UPDATE/DELETE | trigger only (no direct access) |

### `profiles`

| Operation | System | Owner | Admin | Member | Guest |
|-----------|--------|-------|-------|--------|-------|
| SELECT | all | all | all | own | own |
| UPDATE | all | all | subordinates | own (no role change) | own (no role change) |

### `invites`

| Operation | System | Owner | Admin | Member | Guest |
|-----------|--------|-------|-------|--------|-------|
| SELECT | all | all | own | no | no |
| INSERT | yes (owner role) | yes (admin role) | yes (member role) | no | no |

### Example policies

```sql
-- Orders: guests see only their own
CREATE POLICY "guest_select_own" ON orders
  FOR SELECT USING (
    (auth.jwt() ->> 'user_role') = 'guest'
    AND auth.uid() = created_by
  );

-- Orders: internal roles see all
CREATE POLICY "internal_select_all" ON orders
  FOR SELECT USING (
    (auth.jwt() ->> 'user_role') IN ('system', 'owner', 'admin', 'member')
  );

-- Invites: each role can only create invites for the tier below
CREATE POLICY "create_subordinate_invites" ON invites
  FOR INSERT WITH CHECK (
    CASE (auth.jwt() ->> 'user_role')
      WHEN 'system' THEN role = 'owner'
      WHEN 'owner'  THEN role = 'admin'
      WHEN 'admin'  THEN role = 'member'
      ELSE false
    END
  );
```

---

## Execution order

1. **Phase 1** — Base RLS migration. One migration, deploy immediately. Zero app changes needed.
2. **Phase 2** — Profiles, roles, invites, JWT hook. Requires a server action for invites and a registration page.
3. **Phase 3** — Role-based policies. Replace Phase 1 blanket policies. Requires `created_by` / ownership columns on orders (currently missing for guest isolation).

Each phase is a standalone migration that doesn't break the previous one.
