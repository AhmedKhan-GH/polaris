# Order State Machine Refactor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 8-status linear order pipeline with a 6-status industry-standard state machine that separates order lifecycle from payment/fulfillment concerns, adds reversible draft-confirmed transitions, and collapses three terminal statuses into one `cancelled` with reason.

**Architecture:** The order status enum changes from `drafted|submitted|invoiced|closed|archived|discarded|rejected|voided` to `draft|confirmed|processing|fulfilled|closed|cancelled`. The `archived` status becomes a boolean `is_archived` column. The `draft <-> confirmed` transition is bidirectional. Cancellation is available from any non-terminal state. All three enforcement layers (app logic, permissions, DB trigger) are updated in lockstep.

**Tech Stack:** Drizzle ORM, PostgreSQL (enum + trigger), Next.js server actions, React/TanStack Query, Vitest, Playwright

---

### Task 1: Database Migration

This is the foundation — every other task depends on the new enum existing in Postgres.

**Files:**
- Create: `drizzle/0027_refactor_order_statuses.sql`

**Context:** Postgres does not support `ALTER TYPE ... DROP VALUE` or renaming two values to the same target. The safe approach is: create a new enum, migrate columns, drop the old enum, rename the new one. Existing orders in terminal states (`discarded`, `rejected`, `voided`) become `cancelled`. Existing `archived` orders become `closed` with `is_archived = true`.

- [ ] **Step 1: Write the migration SQL**

```sql
-- Step 1: Add the is_archived column before touching the enum
ALTER TABLE "orders" ADD COLUMN "is_archived" boolean NOT NULL DEFAULT false;

-- Step 2: Backfill is_archived from the current 'archived' status
UPDATE "orders" SET "is_archived" = true WHERE "status" = 'archived';
-- Archived orders revert to closed (they were closed before being archived)
UPDATE "orders" SET "status" = 'closed' WHERE "status" = 'archived';

-- Step 3: Collapse terminal statuses into a single value.
-- We'll reuse 'discarded' as the landing pad, then rename it.
UPDATE "orders" SET "status" = 'discarded' WHERE "status" IN ('rejected', 'voided');
-- Also update history tables
UPDATE "order_status_history" SET "from_status" = 'discarded' WHERE "from_status" IN ('rejected', 'voided');
UPDATE "order_status_history" SET "to_status" = 'discarded' WHERE "to_status" IN ('rejected', 'voided');
UPDATE "order_status_history" SET "from_status" = 'closed' WHERE "from_status" = 'archived';
UPDATE "order_status_history" SET "to_status" = 'closed' WHERE "to_status" = 'archived';

-- Step 4: Create the new enum type
CREATE TYPE "order_status_new" AS ENUM (
  'draft',
  'confirmed',
  'processing',
  'fulfilled',
  'closed',
  'cancelled'
);

-- Step 5: Migrate columns from old enum to new enum via text cast
-- Map: drafted->draft, submitted->confirmed, invoiced->processing,
--       closed->fulfilled (current 'closed' becomes 'fulfilled'),
--       discarded->cancelled
-- But wait: we moved archived->closed in step 2, and those SHOULD stay closed.
-- So: closed orders that are is_archived=true stay 'closed' in the new enum.
-- closed orders that are is_archived=false become 'fulfilled'... NO.
-- Actually, let's think about this mapping more carefully:
--   old 'closed' (not archived) -> new 'closed' (it was the final active state)
--   old 'archived' (already moved to 'closed' + is_archived=true) -> new 'closed'
-- The old pipeline was: drafted->submitted->invoiced->closed->archived
-- The new pipeline is: draft->confirmed->processing->fulfilled->closed
-- So old 'closed' maps to new 'closed' (both are the "done" state).
-- We do NOT need a 'fulfilled' migration because old system had no fulfillment concept.

ALTER TABLE "orders"
  ALTER COLUMN "status" TYPE "order_status_new"
  USING (
    CASE "status"::text
      WHEN 'drafted'   THEN 'draft'
      WHEN 'submitted' THEN 'confirmed'
      WHEN 'invoiced'  THEN 'processing'
      WHEN 'closed'    THEN 'closed'
      WHEN 'discarded' THEN 'cancelled'
    END
  )::"order_status_new";

ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'draft'::"order_status_new";

ALTER TABLE "order_status_history"
  ALTER COLUMN "from_status" TYPE "order_status_new"
  USING (
    CASE "from_status"::text
      WHEN 'drafted'   THEN 'draft'
      WHEN 'submitted' THEN 'confirmed'
      WHEN 'invoiced'  THEN 'processing'
      WHEN 'closed'    THEN 'closed'
      WHEN 'discarded' THEN 'cancelled'
      ELSE NULL
    END
  )::"order_status_new";

ALTER TABLE "order_status_history"
  ALTER COLUMN "to_status" TYPE "order_status_new"
  USING (
    CASE "to_status"::text
      WHEN 'drafted'   THEN 'draft'
      WHEN 'submitted' THEN 'confirmed'
      WHEN 'invoiced'  THEN 'processing'
      WHEN 'closed'    THEN 'closed'
      WHEN 'discarded' THEN 'cancelled'
    END
  )::"order_status_new";

-- Step 6: Migrate the order_status_counts table
DELETE FROM "order_status_counts";
INSERT INTO "order_status_counts" ("status", "count")
  SELECT s::"order_status_new", COALESCE(c.cnt, 0)
  FROM unnest(enum_range(NULL::"order_status_new")) s
  LEFT JOIN (
    SELECT "status", COUNT(*) as cnt FROM "orders" GROUP BY "status"
  ) c ON c."status" = s;

-- Step 7: Drop old enum, rename new one
DROP TYPE "order_status";
ALTER TYPE "order_status_new" RENAME TO "order_status";

-- Step 8: Recreate the active index with new status values
DROP INDEX IF EXISTS "orders_active_idx";
CREATE INDEX "orders_active_idx" ON "orders" USING btree (
  "created_at" DESC NULLS LAST, "id" DESC NULLS LAST
) WHERE status IN ('draft', 'confirmed', 'processing', 'fulfilled');

-- Step 9: Replace the enforce_forward_status trigger
CREATE OR REPLACE FUNCTION enforce_forward_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'draft'      AND NEW.status IN ('confirmed', 'cancelled'))   OR
    (OLD.status = 'confirmed'  AND NEW.status IN ('draft', 'processing', 'cancelled')) OR
    (OLD.status = 'processing' AND NEW.status IN ('fulfilled', 'cancelled'))   OR
    (OLD.status = 'fulfilled'  AND NEW.status IN ('closed', 'cancelled'))      OR
    (OLD.status = 'closed'     AND NEW.status = 'closed')
  ) THEN
    RAISE EXCEPTION 'Invalid order status transition: % -> %',
      OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Step 10: Replace the sync_order_status_counts trigger function
-- to handle is_archived not being a status
CREATE OR REPLACE FUNCTION sync_order_status_counts() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE order_status_counts SET count = count + 1 WHERE status = NEW.status;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE order_status_counts SET count = GREATEST(count - 1, 0) WHERE status = OLD.status;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE order_status_counts SET count = GREATEST(count - 1, 0) WHERE status = OLD.status;
    UPDATE order_status_counts SET count = count + 1 WHERE status = NEW.status;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;
```

- [ ] **Step 2: Verify migration runs against a fresh database**

Run: `npx drizzle-kit push` or apply via test container in the integration test suite.

- [ ] **Step 3: Commit**

```bash
git add drizzle/0027_refactor_order_statuses.sql
git commit -m "feat: add migration for 6-status order state machine

Replaces 8-status enum (drafted/submitted/invoiced/closed/archived/
discarded/rejected/voided) with 6 (draft/confirmed/processing/
fulfilled/closed/cancelled). Adds is_archived boolean column.
Updates enforce_forward_status trigger for new transition graph
including reversible draft<->confirmed."
```

---

### Task 2: Domain Model — Update Order Statuses and Type

**Files:**
- Modify: `lib/domain/order.ts`

- [ ] **Step 1: Update ORDER_STATUSES array and category arrays**

In `lib/domain/order.ts`, replace lines 3-28:

```typescript
export const ORDER_STATUSES = [
  'draft',
  'confirmed',
  'processing',
  'fulfilled',
  'closed',
  'cancelled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  'draft',
  'confirmed',
  'processing',
  'fulfilled',
]

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  'closed',
  'cancelled',
]
```

- [ ] **Step 2: Add isArchived to the Order type**

In `lib/domain/order.ts`, add `isArchived: boolean` to the `Order` type after `duplicatedFromOrderId`:

```typescript
export type Order = {
  id: string
  orderNumber: number
  status: OrderStatus
  statusUpdatedAt: number
  duplicatedFromOrderId: string | null
  isArchived: boolean
  createdBy: string | null
  createdByEmail: string | null
  createdAt: number
}
```

- [ ] **Step 3: Update toOrder function**

Add `isArchived` mapping to the `toOrder` function. Update the input type parameter to include `isArchived`:

```typescript
export function toOrder(row: {
  id: string
  orderNumber: number
  status: OrderStatus
  statusUpdatedAt: number
  duplicatedFromOrderId: string | null
  isArchived?: boolean
  createdBy: string | null
  createdByEmail?: string | null
  createdAt: number
}): Order {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    statusUpdatedAt: row.statusUpdatedAt,
    duplicatedFromOrderId: row.duplicatedFromOrderId,
    isArchived: row.isArchived ?? false,
    createdBy: row.createdBy,
    createdByEmail: row.createdByEmail ?? null,
    createdAt: row.createdAt,
  }
}
```

- [ ] **Step 4: Update orderRowSchema**

Add `is_archived` to the Zod schema and map it in the transform:

```typescript
export const orderRowSchema = z
  .object({
    id: z.string().uuid(),
    order_number: z
      .union([z.number(), z.string()])
      .transform((v) => (typeof v === 'number' ? v : Number(v))),
    status: z.enum(ORDER_STATUSES),
    status_updated_at: epochMs,
    duplicated_from_order_id: z.string().uuid().nullable(),
    is_archived: z.boolean().optional().default(false),
    created_by: z.string().uuid().nullable().optional().default(null),
    created_by_email: z.string().nullable().optional().default(null),
    created_at: epochMs,
  })
  .transform((row): Order => ({
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    statusUpdatedAt: row.status_updated_at,
    duplicatedFromOrderId: row.duplicated_from_order_id,
    isArchived: row.is_archived,
    createdBy: row.created_by,
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
  }))
```

- [ ] **Step 5: Commit**

```bash
git add lib/domain/order.ts
git commit -m "feat: update Order domain model to 6-status enum with isArchived"
```

---

### Task 3: Update Unit Tests for Domain Model

**Files:**
- Modify: `lib/domain/order.test.ts`
- Modify: `lib/services/orderService.test.ts`

- [ ] **Step 1: Update order.test.ts**

Replace all `'drafted'` with `'draft'` in test data. Add `isArchived: false` to all expected Order objects.

In `baseRow` (line 13-21):
```typescript
const baseRow = {
  id: '7c16d5b1-6f83-45a2-9a9d-1f0dc1f1a2e4',
  orderNumber: 1_000_000,
  status: 'draft' as const,
  statusUpdatedAt: Date.UTC(2026, 3, 19, 12, 0, 0),
  duplicatedFromOrderId: null,
  isArchived: false,
  createdBy: null,
  createdByEmail: null,
  createdAt: Date.UTC(2026, 3, 19, 12, 0, 0),
}
```

In `parseOrderRow` validRow (line 46-51):
```typescript
const validRow = {
  id: '7c16d5b1-6f83-45a2-9a9d-1f0dc1f1a2e4',
  order_number: '1000001',
  status: 'draft',
  status_updated_at: tsMs,
  duplicated_from_order_id: null,
  created_at: tsMs,
}
```

In the `parseOrderRow` 'converts a raw row' test expectation (line 55-64), add `isArchived: false`:
```typescript
expect(parseOrderRow(validRow)).toEqual({
  id: validRow.id,
  orderNumber: 1_000_001,
  status: 'draft',
  statusUpdatedAt: tsMs,
  duplicatedFromOrderId: null,
  isArchived: false,
  createdBy: null,
  createdByEmail: null,
  createdAt: tsMs,
})
```

In `safeParseOrder` valid row test (line 117-138), update `status: 'draft'` and add `isArchived: false` to expectation.

- [ ] **Step 2: Update orderService.test.ts**

In `lib/services/orderService.test.ts` line 27-35, change `status: 'drafted'` to `status: 'draft'` and add `isArchived: false`:

```typescript
const order: Order = {
  id: '7c16d5b1-6f83-45a2-9a9d-1f0dc1f1a2e4',
  orderNumber: 1_000_000,
  status: 'draft',
  statusUpdatedAt: Date.UTC(2026, 3, 19, 12, 0, 0),
  duplicatedFromOrderId: null,
  isArchived: false,
  createdBy: null,
  createdByEmail: null,
  createdAt: Date.UTC(2026, 3, 19, 12, 0, 0),
}
```

- [ ] **Step 3: Run unit tests**

Run: `npx vitest run lib/domain/order.test.ts lib/services/orderService.test.ts`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/domain/order.test.ts lib/services/orderService.test.ts
git commit -m "test: update unit tests for 6-status order model"
```

---

### Task 4: Update Drizzle Schema

**Files:**
- Modify: `lib/schema.ts`

- [ ] **Step 1: Update the pgEnum definition**

Replace lines 51-60:
```typescript
export const orderStatus = pgEnum("order_status", [
  "draft",
  "confirmed",
  "processing",
  "fulfilled",
  "closed",
  "cancelled",
]);
```

- [ ] **Step 2: Add isArchived column and update default status**

In the `orders` table definition, change the default from `"drafted"` to `"draft"` (line 74) and add the `isArchived` column after `duplicatedFromOrderId`:

```typescript
status: orderStatus("status").notNull().default("draft"),
```

Add after `duplicatedFromOrderId` line:
```typescript
isArchived: boolean("is_archived").notNull().default(false),
```

Note: You'll need to import `boolean` from `drizzle-orm/pg-core`.

- [ ] **Step 3: Update the active index WHERE clause**

Replace the `orders_active_idx` WHERE clause (line 88):
```typescript
sql`status IN ('draft', 'confirmed', 'processing', 'fulfilled')`,
```

- [ ] **Step 4: Update the guest RLS policy**

Replace `'drafted'` with `'draft'` in the guest update policy (line 142):
```typescript
AND ${table.status} = 'draft'
```

- [ ] **Step 5: Update orderWithCreator select in orderRepository.ts**

In `lib/db/orderRepository.ts`, add `isArchived` to the `orderWithCreator` select object (around line 114-123):

```typescript
const orderWithCreator = {
  id: orders.id,
  orderNumber: orders.orderNumber,
  status: orders.status,
  statusUpdatedAt: orders.statusUpdatedAt,
  duplicatedFromOrderId: orders.duplicatedFromOrderId,
  isArchived: orders.isArchived,
  createdBy: orders.createdBy,
  createdByEmail: profiles.email,
  createdAt: orders.createdAt,
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/schema.ts lib/db/orderRepository.ts
git commit -m "feat: update Drizzle schema for 6-status enum with isArchived column"
```

---

### Task 5: Update Transition Graph and Repository

**Files:**
- Modify: `lib/db/orderRepository.ts`

- [ ] **Step 1: Update VALID_TRANSITIONS**

Replace lines 35-44:
```typescript
export const VALID_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft:      ['confirmed', 'cancelled'],
  confirmed:  ['draft', 'processing', 'cancelled'],
  processing: ['fulfilled', 'cancelled'],
  fulfilled:  ['closed', 'cancelled'],
  closed:     [],
  cancelled:  [],
}
```

- [ ] **Step 2: Update findDraftsByCreator**

Replace `'drafted'` with `'draft'` on line 206:
```typescript
eq(orders.status, 'draft' as OrderStatus),
```

- [ ] **Step 3: Update countDraftsByCreator**

Replace `'drafted'` with `'draft'` on line 234:
```typescript
eq(orders.status, 'draft' as OrderStatus),
```

- [ ] **Step 4: Rename discardDraftOrder to cancelOrder**

Replace the `discardDraftOrder` function (lines 354-363):
```typescript
export async function cancelOrder(args: {
  orderId: string
  changedBy: string | null
  reason?: string
}): Promise<Order> {
  return transitionOrderStatus({
    ...args,
    toStatus: 'cancelled',
  })
}
```

- [ ] **Step 5: Update duplicateOrder history entry**

Replace `'drafted'` with `'draft'` on line 386:
```typescript
toStatus: 'draft',
```

- [ ] **Step 6: Commit**

```bash
git add lib/db/orderRepository.ts
git commit -m "feat: update order transition graph and rename discardDraftOrder to cancelOrder"
```

---

### Task 6: Update Permissions Layer

**Files:**
- Modify: `lib/permissions/abilities.ts`
- Modify: `lib/permissions/subjects/order.ts`

- [ ] **Step 1: Update VALID_TRANSITIONS in abilities.ts**

Replace lines 29-38:
```typescript
const VALID_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft:      ['confirmed', 'cancelled'],
  confirmed:  ['draft', 'processing', 'cancelled'],
  processing: ['fulfilled', 'cancelled'],
  fulfilled:  ['closed', 'cancelled'],
  closed:     [],
  cancelled:  [],
}
```

- [ ] **Step 2: Update getAllowedTransitions**

Replace the `getAllowedTransitions` function (lines 40-49). The `discard` action becomes `cancel`:

```typescript
export function getAllowedTransitions(role: UserRole, status: OrderStatus): readonly OrderStatus[] {
  const all = VALID_TRANSITIONS[status]
  const ability = defineAbilityFor(role)

  return all.filter((toStatus) => {
    if (toStatus === 'cancelled') return ability.can('cancel', 'Order')
    if (!ability.can('transition', 'Order')) return false
    if (role === 'guest' && status !== 'draft') return false
    return true
  })
}
```

- [ ] **Step 3: Update the Actions type and order permissions**

In `lib/permissions/abilities.ts`, update the Actions type (line 10):
```typescript
type Actions = 'create' | 'read' | 'transition' | 'cancel' | 'duplicate' | 'manage'
```

In `lib/permissions/subjects/order.ts`, rename `discard` to `cancel`:
```typescript
export const orderPermissions = {
  create:     { roles: ['guest', 'member', 'admin', 'owner'] },
  read:       { roles: ['guest', 'member', 'admin', 'owner', 'system'] },
  transition: { roles: ['guest', 'member', 'admin', 'owner'] },
  cancel:     { roles: ['guest', 'member', 'admin', 'owner'] },
  duplicate:  { roles: ['guest', 'member', 'admin', 'owner'] },
} as const satisfies SubjectPermissions
```

- [ ] **Step 4: Commit**

```bash
git add lib/permissions/abilities.ts lib/permissions/subjects/order.ts
git commit -m "feat: update permissions for cancel action and new transition graph"
```

---

### Task 7: Update Server Actions

**Files:**
- Modify: `app/_features/orders/data/actions.ts`

- [ ] **Step 1: Update imports**

Replace `discardDraftOrder` import with `cancelOrder`:
```typescript
import {
  countFilteredOrders,
  countFilteredOrdersByStatus,
  countOrders,
  countOrdersByStatus,
  cancelOrder,
  duplicateOrder,
  findFilteredOrdersPage,
  findOrderById,
  findOrdersPage,
  findOrdersPageByStatus,
  transitionOrderStatus,
  type OrderStatusCounts,
} from '@/lib/db/orderRepository'
```

- [ ] **Step 2: Rename discardDraftOrderAction to cancelOrderAction**

Replace the `discardDraftOrderAction` function (lines 214-238):
```typescript
export async function cancelOrderAction(rawArgs: unknown): Promise<Order> {
  const args = discardInput.parse(rawArgs)

  return withPermission('cancel', 'Order', async ({ profile }) => {
    const order = await findOrderById(args.orderId)
    if (!order) throw new Error('Order not found')

    const allowed = getAllowedTransitions(profile.role, order.status)
    if (!allowed.includes('cancelled')) {
      throw new Error('Cancellation is not allowed for this order')
    }

    const actor = await getActorId()
    try {
      return await cancelOrder({
        orderId: args.orderId,
        changedBy: actor,
        reason: args.reason,
      })
    } catch (err) {
      log.warn({ err, orderId: args.orderId }, 'cancelOrderAction rejected')
      throw err
    }
  })
}
```

- [ ] **Step 3: Update transitionOrderAction validation**

In `transitionOrderAction` (around line 192), the `'discarded'` check doesn't exist but verify the allowed check references the correct status values.

- [ ] **Step 4: Commit**

```bash
git add app/_features/orders/data/actions.ts
git commit -m "feat: rename discardDraftOrderAction to cancelOrderAction"
```

---

### Task 8: Update Client-Side Hooks

**Files:**
- Modify: `app/_features/orders/data/useOrderActions.ts`

- [ ] **Step 1: Update imports**

Replace `discardDraftOrderAction` with `cancelOrderAction`:
```typescript
import {
  cancelOrderAction,
  duplicateOrderAction,
  transitionOrderAction,
} from './actions'
```

- [ ] **Step 2: Rename discardDraft mutation to cancel**

Replace the `discardDraft` mutation (lines 203-210):
```typescript
const cancel = useMutation({
  mutationFn: (args: { orderId: string; reason?: string }) =>
    cancelOrderAction(args),
  onMutate: (args) =>
    applyOptimisticTransition(queryClient, args.orderId, 'cancelled'),
  onError: (_err, _args, ctx) => {
    if (ctx) rollbackTransition(queryClient, ctx)
  },
})
```

- [ ] **Step 3: Update the return interface and return value**

Update `UseOrderActionsResult`:
```typescript
export interface UseOrderActionsResult {
  transition: (args: {
    orderId: string
    toStatus: OrderStatus
    reason?: string
  }) => Promise<Order>
  cancel: (args: { orderId: string; reason?: string }) => Promise<Order>
  duplicate: (args: { sourceOrderId: string }) => Promise<Order>
  isPending: boolean
  error: Error | null
}
```

Update the return statement:
```typescript
const isPending =
  transition.isPending || cancel.isPending || duplicate.isPending
const error =
  transition.error ?? cancel.error ?? duplicate.error ?? null

return {
  transition: (args) => transition.mutateAsync(args),
  cancel: (args) => cancel.mutateAsync(args),
  duplicate: (args) => duplicate.mutateAsync(args),
  isPending,
  error,
}
```

- [ ] **Step 4: Commit**

```bash
git add app/_features/orders/data/useOrderActions.ts
git commit -m "feat: rename discardDraft to cancel in useOrderActions hook"
```

---

### Task 9: Update Status Visual Tones

**Files:**
- Modify: `app/_features/orders/shared/statusTones.ts`

- [ ] **Step 1: Replace all three tone maps**

```typescript
import type { OrderStatus } from '@/lib/domain/order'

export const STATUS_BADGE_TONES: Record<OrderStatus, string> = {
  draft:      'border-zinc-500/30 bg-zinc-700/50 text-zinc-200',
  confirmed:  'border-blue-400/30 bg-blue-500/15 text-blue-300',
  processing: 'border-violet-400/30 bg-violet-500/15 text-violet-300',
  fulfilled:  'border-emerald-400/30 bg-emerald-500/15 text-emerald-300',
  closed:     'border-zinc-400/30 bg-zinc-500/15 text-zinc-300',
  cancelled:  'border-red-500/30 bg-red-500/10 text-red-300',
}

export const STATUS_BUTTON_TONES: Record<OrderStatus, string> = {
  draft:      'border-zinc-500/40 bg-zinc-700/30 text-zinc-200 hover:bg-zinc-700/45',
  confirmed:  'border-blue-500/40 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25',
  processing: 'border-violet-500/40 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25',
  fulfilled:  'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25',
  closed:     'border-zinc-500/40 bg-zinc-500/15 text-zinc-300 hover:bg-zinc-500/25',
  cancelled:  'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20',
}

export const STATUS_PANEL_BORDER_TONES: Record<OrderStatus, string> = {
  draft:      'border-zinc-600/70',
  confirmed:  'border-blue-500/50',
  processing: 'border-violet-500/50',
  fulfilled:  'border-emerald-500/50',
  closed:     'border-zinc-500/50',
  cancelled:  'border-red-500/50',
}
```

- [ ] **Step 2: Commit**

```bash
git add app/_features/orders/shared/statusTones.ts
git commit -m "feat: update status visual tones for 6-status order model"
```

---

### Task 10: Update Kanban Board

**Files:**
- Modify: `app/_features/orders/views/kanban/KanbanBoard.tsx`

- [ ] **Step 1: Update ALL_COLUMNS**

Replace lines 9-14:
```typescript
const ALL_COLUMNS: ReadonlyArray<{ name: string; status: OrderStatus }> = [
  { name: 'Draft',      status: 'draft' },
  { name: 'Confirmed',  status: 'confirmed' },
  { name: 'Processing', status: 'processing' },
  { name: 'Fulfilled',  status: 'fulfilled' },
]
```

- [ ] **Step 2: Commit**

```bash
git add app/_features/orders/views/kanban/KanbanBoard.tsx
git commit -m "feat: update kanban columns for new order statuses"
```

---

### Task 11: Update List View Constants

**Files:**
- Modify: `app/_features/orders/views/list/constants.ts`

- [ ] **Step 1: Update STATUS_FILTER_GROUPS**

Replace lines 7-9:
```typescript
export const STATUS_FILTER_GROUPS: readonly (readonly OrderStatus[])[] = [
  ['draft', 'confirmed', 'processing', 'fulfilled'],
  ['closed', 'cancelled'],
]
```

- [ ] **Step 2: Commit**

```bash
git add app/_features/orders/views/list/constants.ts
git commit -m "feat: update list view filter groups for new statuses"
```

---

### Task 12: Update Order Detail Sidebar

**Files:**
- Modify: `app/_features/orders/sidebar/OrderDetailSidebar.tsx`

- [ ] **Step 1: Update ACTION_DESCRIPTIONS**

Replace lines 26-35:
```typescript
const ACTION_DESCRIPTIONS: Record<OrderStatus, string> = {
  draft:      '',
  confirmed:  'This confirms the order and locks it for processing.',
  processing: 'This moves the order into active processing and fulfillment.',
  fulfilled:  'This marks all items as delivered.',
  closed:     'This closes the order. Payment is settled and all items are delivered.',
  cancelled:  'This cancels the order. A reason will be recorded in the audit history.',
}
```

- [ ] **Step 2: Update ACTIONS_BY_STATUS**

Replace lines 46-66:
```typescript
const ACTIONS_BY_STATUS: Record<OrderStatus, ActionConfig[]> = {
  draft: [
    { label: 'Confirm',  toStatus: 'confirmed', tone: 'primary' },
    { label: 'Cancel',   toStatus: 'cancelled', tone: 'terminal' },
  ],
  confirmed: [
    { label: 'Revert to Draft', toStatus: 'draft', tone: 'terminal' },
    { label: 'Process', toStatus: 'processing', tone: 'primary' },
    { label: 'Cancel',  toStatus: 'cancelled',  tone: 'terminal' },
  ],
  processing: [
    { label: 'Fulfill', toStatus: 'fulfilled', tone: 'primary' },
    { label: 'Cancel',  toStatus: 'cancelled', tone: 'terminal' },
  ],
  fulfilled: [
    { label: 'Close', toStatus: 'closed', tone: 'primary' },
    { label: 'Cancel', toStatus: 'cancelled', tone: 'terminal' },
  ],
  closed:    [],
  cancelled: [],
}
```

- [ ] **Step 3: Update SidebarBody to use cancel instead of discardDraft**

In the `SidebarBody` component, update the destructured `useOrderActions()` call:
```typescript
const { transition, cancel, duplicate, isPending, error } =
  useOrderActions()
```

Update `runTransition` to use `cancel` instead of `discardDraft`:
```typescript
async function runTransition(action: ActionConfig): Promise<boolean> {
  try {
    if (action.toStatus === 'cancelled') {
      await cancel({ orderId: order.id })
    } else {
      await transition({
        orderId: order.id,
        toStatus: action.toStatus,
      })
    }
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Update the confirmation modal copy for reversible transitions**

In `ConfirmActionModal`, the line "This action is final and cannot be reversed." should only show for non-reversible transitions. The `draft -> confirmed` transition is explicitly reversible, and `confirmed -> draft` (revert) is the reverse. Update the modal:

```typescript
const isReversible = action.toStatus === 'confirmed' || action.toStatus === 'draft'
```

Then conditionally show:
```typescript
{!isReversible && (
  <span className="font-medium text-zinc-200">
    This action is final and cannot be reversed.
  </span>
)}
```

- [ ] **Step 5: Update ConfirmDuplicateModal text**

Change "drafted" to "draft" in the description text:
```typescript
This creates a new order in <span className="font-medium text-zinc-200">draft</span> status
```

- [ ] **Step 6: Update STATUS_BUTTON_TONES references**

The `Duplicate` button references `STATUS_BUTTON_TONES.drafted` — change to `STATUS_BUTTON_TONES.draft`.
The `ConfirmDuplicateModal` references `STATUS_PANEL_BORDER_TONES.drafted` — change to `STATUS_PANEL_BORDER_TONES.draft`.

- [ ] **Step 7: Commit**

```bash
git add app/_features/orders/sidebar/OrderDetailSidebar.tsx
git commit -m "feat: update sidebar actions for new state machine with reversible transitions"
```

---

### Task 13: Update OrderDetailPanel (board/list view panel)

**Files:**
- Modify: `app/_features/orders/views/OrderDetailPanel.tsx`

- [ ] **Step 1: Update ACTION_LABELS**

Replace lines 22-31:
```typescript
const ACTION_LABELS: Record<OrderStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirm',
  processing: 'Process',
  fulfilled: 'Fulfill',
  closed: 'Close',
  cancelled: 'Cancel',
}
```

- [ ] **Step 2: Update ACTION_DESCRIPTIONS**

Replace lines 33-42:
```typescript
const ACTION_DESCRIPTIONS: Record<OrderStatus, string> = {
  draft: '',
  confirmed: 'This confirms the order and locks it for processing.',
  processing: 'This moves the order into active processing and fulfillment.',
  fulfilled: 'This marks all items as delivered.',
  closed: 'This closes the order. Payment is settled and all items are delivered.',
  cancelled: 'This cancels the order. A reason will be recorded in the audit history.',
}
```

- [ ] **Step 3: Update primary/terminal action logic**

Replace the `primaryAction` and `terminalAction` derivation (lines 60-61):
```typescript
const primaryAction = transitions.find((s) => s !== 'cancelled' && s !== 'draft') ?? null
const terminalAction = transitions.find((s) => s === 'cancelled') ?? null
```

Note: `draft` appears as a transition target when reverting from `confirmed`. It should show as a separate button, not the primary. Handle the "Revert to Draft" case:
```typescript
const revertAction = transitions.find((s) => s === 'draft') ?? null
```

- [ ] **Step 4: Update handleConfirm to use cancel**

Replace `discardDraft` calls with `cancel`:
```typescript
const { transition, cancel, duplicate, isPending, error } =
  useOrderActions()

// ...

async function handleConfirm() {
  if (!pendingAction) return
  setPendingAction(null)
  if (pendingAction === 'duplicate') {
    await duplicate({ sourceOrderId: order.id }).catch(() => {})
  } else if (pendingAction === 'cancelled') {
    await cancel({ orderId: order.id }).catch(() => {})
  } else {
    await transition({ orderId: order.id, toStatus: pendingAction }).catch(() => {})
  }
}
```

- [ ] **Step 5: Update STATUS_BUTTON_TONES.drafted references**

Change `STATUS_BUTTON_TONES.drafted` to `STATUS_BUTTON_TONES.draft` for the Duplicate button.

- [ ] **Step 6: Update STATUS_PANEL_BORDER_TONES.drafted reference**

Change `STATUS_PANEL_BORDER_TONES[pendingAction === 'duplicate' ? 'drafted' : pendingAction]` to `STATUS_PANEL_BORDER_TONES[pendingAction === 'duplicate' ? 'draft' : pendingAction]`.

- [ ] **Step 7: Update the irreversibility warning**

The confirmation modal says "This action is final and cannot be reversed." — make this conditional:
```typescript
{pendingAction !== 'duplicate' && pendingAction !== 'confirmed' && pendingAction !== 'draft' && (
  <span className="font-medium text-zinc-200">
    This action is final and cannot be reversed.
  </span>
)}
```

- [ ] **Step 8: Commit**

```bash
git add app/_features/orders/views/OrderDetailPanel.tsx
git commit -m "feat: update OrderDetailPanel for new statuses and cancel action"
```

---

### Task 14: Update Integration Tests

**Files:**
- Modify: `lib/db/orderRepository.integration.test.ts`

- [ ] **Step 1: Update seedOrder default status**

Line 57: change `'drafted'` to `'draft'`:
```typescript
[order.id, order.orderNumber, order.status ?? 'draft', order.createdAt],
```

- [ ] **Step 2: Update all test status literals**

Replace every occurrence:
- `'drafted'` -> `'draft'`
- `'submitted'` -> `'confirmed'`
- `'invoiced'` -> `'processing'`
- `'discarded'` -> `'cancelled'`
- `'rejected'` -> `'cancelled'`
- `'voided'` -> `'cancelled'`
- `'archived'` -> remove (no longer a status)

Key tests to update:

**insertOrder test** (line 128): `expect(order.status).toBe('draft')`

**findAllOrders test** (lines 112-119): Update the expected keys array to include `isArchived`:
```typescript
expect(Object.keys(order).sort()).toEqual([
  'createdAt',
  'duplicatedFromOrderId',
  'id',
  'isArchived',
  'orderNumber',
  'status',
  'statusUpdatedAt',
])
```

**findFilteredOrdersPage test** (lines 199-205): Change seed statuses from `'drafted'`/`'submitted'`/`'closed'` to `'draft'`/`'confirmed'`/`'closed'`

**countFilteredOrdersByStatus test** (lines 277-311): Change seed statuses and assertions. Replace `'voided'` seed with `'cancelled'`. Update assertions from `counts.submitted` to `counts.confirmed`, `counts.drafted` to `counts.draft`.

**countOrdersByStatus test** (lines 330-344): Change `'submitted'` to `'confirmed'` and `'drafted'` to `'draft'`:
```typescript
expect(counts.draft).toBe(1)
expect(counts.confirmed).toBe(1)
expect(counts.processing).toBe(0)
```

**findOrdersPageByStatus test** (lines 363-388): Replace `'drafted'`/`'submitted'` with `'draft'`/`'confirmed'`

**findFilteredOrdersPage empty test** (lines 390-404): Replace `'drafted'`/`'submitted'` with `'draft'`/`'confirmed'`

**transitionOrderStatus tests** (lines 438-593):
- "moves drafted -> submitted" becomes "moves draft -> confirmed"
- "rejects a backward transition" — now `confirmed -> draft` IS valid, so test a different case: `processing -> confirmed`
- "rejects a cross-branch transition (drafted -> invoiced)" becomes "rejects a cross-branch transition (draft -> processing)"
- "rejects a transition out of a terminal state" — use `cancelled` instead of `discarded`
- Full lifecycle test: `draft -> confirmed -> processing -> fulfilled -> closed` (no archived step)
- "rejects skipping" test: `processing -> closed` should fail

**discardDraftOrder tests** (lines 595-623): Rename to `cancelOrder`:
- "cancels a draft" test
- "refuses to cancel a closed order" test (closed is terminal, can't cancel)

**duplicateOrder tests** (lines 625-745):
- Update all status transitions to use new names
- "works from any source state" — test `cancelled` and `closed` as terminal states
- History entries use `'draft'` instead of `'drafted'`

- [ ] **Step 3: Add test for reversible draft<->confirmed transition**

```typescript
test('allows confirmed -> draft (reversible transition)', async () => {
  const order = await repo.insertOrder()
  await repo.transitionOrderStatus({
    orderId: order.id,
    toStatus: 'confirmed',
    changedBy: ACTOR,
  })
  const reverted = await repo.transitionOrderStatus({
    orderId: order.id,
    toStatus: 'draft',
    changedBy: ACTOR,
    reason: 'needs revision',
  })

  expect(reverted.status).toBe('draft')
})
```

- [ ] **Step 4: Add test for cancellation from multiple states**

```typescript
test('allows cancellation from any active state', async () => {
  for (const targetStatus of ['draft', 'confirmed', 'processing', 'fulfilled'] as const) {
    const order = await repo.insertOrder()
    // Walk to the target status
    const path: OrderStatus[] = ['confirmed', 'processing', 'fulfilled']
    for (const step of path) {
      if (step === targetStatus) break
      // skip if we're already past it
      const current = (await repo.findOrderById(order.id))!
      if (current.status === targetStatus) break
      await repo.transitionOrderStatus({
        orderId: order.id,
        toStatus: step,
        changedBy: ACTOR,
      })
    }

    const cancelled = await repo.cancelOrder({
      orderId: order.id,
      changedBy: ACTOR,
      reason: `cancelled from ${targetStatus}`,
    })
    expect(cancelled.status).toBe('cancelled')
  }
})
```

- [ ] **Step 5: Run integration tests**

Run: `npx vitest run lib/db/orderRepository.integration.test.ts`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/db/orderRepository.integration.test.ts
git commit -m "test: update integration tests for 6-status order state machine"
```

---

### Task 15: Update E2E Tests

**Files:**
- Modify: `tests/e2e/order-lifecycle.spec.ts`
- Modify: `tests/e2e/discard-draft.spec.ts`
- Modify: `tests/e2e/reject-void.spec.ts`
- Modify: `tests/e2e/duplicate-order.spec.ts`
- Modify: `tests/e2e/list-view-filter.spec.ts`

- [ ] **Step 1: Update order-lifecycle.spec.ts**

The test name and flow changes from `draft -> submit -> invoice -> close -> archive` to `draft -> confirm -> process -> fulfill -> close`:

```typescript
test("draft -> confirm -> process -> fulfill -> close", async ({ page }) => {
  await login(page);

  const draftHeading = page.getByRole("heading", {
    name: "Draft",
    level: 2,
  });
  await expect(draftHeading).toBeVisible();

  await page.getByRole("button", { name: "Draft", exact: true }).click();

  const draftColumn = draftHeading.locator(
    "xpath=ancestor::section[1]",
  );
  const firstCard = draftColumn.locator(".overflow-y-auto button").first();
  await expect(firstCard).toBeVisible({ timeout: 10_000 });
  await firstCard.click();

  const sidebar = page.locator("aside");
  await expect(sidebar).toHaveAttribute("aria-hidden", "false", {
    timeout: 5_000,
  });

  await confirmAction(page, "Confirm");
  await confirmAction(page, "Process");
  await confirmAction(page, "Fulfill");
  await confirmAction(page, "Close");

  // Closed is terminal — sidebar should close
  await expect(sidebar).toHaveAttribute("aria-hidden", "true", {
    timeout: 10_000,
  });
});
```

- [ ] **Step 2: Update discard-draft.spec.ts**

Rename to cancellation semantics. Update heading references from "Drafted" to "Draft", button from "Discard" to "Cancel":

```typescript
function draftCount(page: Page) {
  return page
    .getByRole("heading", { name: "Draft", level: 2 })
    .locator("xpath=following-sibling::span[1]");
}

test.describe("cancel draft", () => {
  // ...
  test("cancelling a draft removes it from the kanban", async ({ page }) => {
    await login(page);

    const draftHeading = page.getByRole("heading", {
      name: "Draft",
      level: 2,
    });
    await expect(draftHeading).toBeVisible();

    const beforeText = await draftCount(page).textContent();
    const before = Number(beforeText ?? "0");

    await page.getByRole("button", { name: "Draft", exact: true }).click();

    await expect(draftCount(page)).toHaveText(String(before + 1), {
      timeout: 10_000,
    });

    const draftColumn = draftHeading.locator(
      "xpath=ancestor::section[1]",
    );
    await draftColumn.locator(".overflow-y-auto button").first().click();

    const sidebar = page.locator("aside");
    await expect(sidebar).toHaveAttribute("aria-hidden", "false", {
      timeout: 5_000,
    });

    const cancelBtn = sidebar.getByRole("button", {
      name: "Cancel",
      exact: true,
    });
    await expect(cancelBtn).toBeEnabled({ timeout: 10_000 });
    await cancelBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    await expect(sidebar).toHaveAttribute("aria-hidden", "true", {
      timeout: 10_000,
    });

    await expect(draftCount(page)).toHaveText(String(before), {
      timeout: 10_000,
    });
  });
});
```

Note: The "Cancel" button label in the confirmation dialog conflicts with the dialog dismiss button also labeled "Cancel". You may need to distinguish — the dismiss button could use "Go Back" or you can target by position. Check if the existing `ConfirmActionModal` cancel button is labeled differently. Looking at the code, the dismiss button says "Cancel" and the confirm button says the action label. So if the action label is "Cancel", both buttons say "Cancel". **This is a UX bug to fix**: rename the dismiss button to "Go Back" in the modal, or rename the cancel action button to "Cancel Order".

For the E2E test, use the confirm button (which has `autoFocus`):
```typescript
await dialog
  .getByRole("button", { name: "Cancel", exact: true })
  .last()
  .click();
```

Or better: fix the action label to "Cancel Order" in `ACTIONS_BY_STATUS` to avoid ambiguity.

- [ ] **Step 3: Update reject-void.spec.ts**

This test file becomes a cancellation test. Replace with:

```typescript
test.describe("cancellation paths", () => {
  // ...
  test("cancelling a confirmed order closes the sidebar", async ({ page }) => {
    await login(page);
    await expect(
      page.getByRole("heading", { name: "Draft", level: 2 }),
    ).toBeVisible();

    await createAndOpenDraft(page);
    await confirmAction(page, "Confirm");

    const sidebar = page.locator("aside");
    await expect(
      sidebar.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    await confirmAction(page, "Cancel");

    await expect(sidebar).toHaveAttribute("aria-hidden", "true", {
      timeout: 10_000,
    });
  });
});
```

Update `createAndOpenDraft` to reference "Draft" heading instead of "Drafted".

- [ ] **Step 4: Update duplicate-order.spec.ts**

Replace all "Drafted" heading references with "Draft", "Submit" with "Confirm", "Invoice" with "Process":

```typescript
function draftCount(page: Page) {
  return page
    .getByRole("heading", { name: "Draft", level: 2 })
    .locator("xpath=following-sibling::span[1]");
}
```

Update the submit step to confirm step:
```typescript
const confirmBtn = sidebar.getByRole("button", {
  name: "Confirm",
  exact: true,
});
```

And the waiting assertion:
```typescript
await expect(
  sidebar.getByRole("button", { name: "Process", exact: true }),
).toBeVisible({ timeout: 10_000 });
```

- [ ] **Step 5: Update list-view-filter.spec.ts**

Replace `drafted` and `submitted` checkbox names:
```typescript
const draftCheckbox = menu.getByRole("checkbox", {
  name: /draft/i,
});
const confirmedCheckbox = menu.getByRole("checkbox", {
  name: /confirmed/i,
});
```

Update the final assertion:
```typescript
const draftAfter = reopenedMenu.getByRole("checkbox", {
  name: /draft/i,
});
```

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/
git commit -m "test: update E2E tests for new order state machine"
```

---

### Task 16: Fix Cancel Button Ambiguity in Confirmation Modal

**Files:**
- Modify: `app/_features/orders/sidebar/OrderDetailSidebar.tsx`
- Modify: `app/_features/orders/views/OrderDetailPanel.tsx`

The confirmation modal has a "Cancel" dismiss button and the cancel action is also labeled "Cancel". This creates ambiguity for both users and E2E tests.

- [ ] **Step 1: Rename the dismiss button to "Go Back" in ConfirmActionModal**

In `OrderDetailSidebar.tsx` `ConfirmActionModal`, change the dismiss button text:
```typescript
<button
  type="button"
  disabled={isPending}
  onClick={onCancel}
  className="rounded border border-zinc-700 bg-transparent px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
>
  Go Back
</button>
```

Do the same in the `ConfirmDuplicateModal` dismiss button.

- [ ] **Step 2: Same change in OrderDetailPanel.tsx**

Update the dismiss button in the confirmation dialog (line 212-218):
```typescript
Go Back
```

- [ ] **Step 3: Commit**

```bash
git add app/_features/orders/sidebar/OrderDetailSidebar.tsx app/_features/orders/views/OrderDetailPanel.tsx
git commit -m "fix: rename modal dismiss button to 'Go Back' to avoid Cancel ambiguity"
```

---

### Task 17: TypeScript Compilation Check

- [ ] **Step 1: Run the TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: No errors. If there are errors, they'll point to missed references to old status values.

- [ ] **Step 2: Fix any remaining references**

Search for any remaining old status literals:
```bash
grep -rn "'drafted'\|'submitted'\|'invoiced'\|'discarded'\|'rejected'\|'voided'\|'archived'" --include='*.ts' --include='*.tsx' lib/ app/
```

Fix any found references.

- [ ] **Step 3: Run unit tests**

Run: `npx vitest run`
Expected: All unit tests pass.

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: resolve remaining old status references caught by tsc"
```

---

### Task 18: Manual Verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify the kanban board shows 4 columns**

Columns should be: Draft, Confirmed, Processing, Fulfilled.

- [ ] **Step 3: Create a new draft order and walk it through the lifecycle**

Click Draft -> select the order -> Confirm -> Process -> Fulfill -> Close. Each transition should work and the order should move between columns.

- [ ] **Step 4: Test the reversible transition**

Create a draft, confirm it, then click "Revert to Draft". The order should move back to the Draft column.

- [ ] **Step 5: Test cancellation from multiple states**

Create orders and cancel them from draft, confirmed, and processing states. Each should transition to cancelled and close the sidebar.

- [ ] **Step 6: Test the list view**

Switch to list view. Verify filter checkboxes show the new status names. Verify filtering works.

- [ ] **Step 7: Test the detail view**

Switch to detail view. Verify the status dropdown shows all 6 statuses with correct counts.
