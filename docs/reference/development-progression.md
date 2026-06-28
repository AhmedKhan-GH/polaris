# Development Progression

## When to Wire Primitives vs. Extract Abstractions

### Phase 1: Wire Primitives (where you are now)

Use libraries directly. No custom classes, no shared helpers, no base classes. Each feature is self-contained.

**Auth:** Supabase client, Zod schema, server action, redirect. All inline.

**Permissions:** Drizzle table, CASL rules, server action guard. First abstraction emerges — `withPermission()` — because every future server action needs the same check.

**First domain feature (vehicles):** Drizzle table, server actions, components. Write it inline. No repository pattern, no service layer, no base entity class.

**Second domain feature (customers):** Write it inline again. Notice you're copying the same Drizzle insert → error handling → revalidate pattern from vehicles.

### Phase 2: Extract From Duplication (after 2-3 domain features)

When you've written the same pattern three times, extract it. Not before.

**What to extract and when:**

| Pattern | Extract after | What it becomes |
|---|---|---|
| Server action permission check | 1st feature (permissions) | `withPermission()` guard |
| Server action error handling | 2nd domain feature | Shared error response type + handler |
| Drizzle insert/update/findById | 3rd domain feature | Repository helpers or base repository |
| Form validation + error display | 3rd form | Shared form error component |
| Table/list display | 3rd list view | Shared data table component |
| CASL subject definition | 3rd subject file | Validated by the pattern — keep per-subject files |
| Test setup (mock Supabase, mock db) | 3rd test file with same mocks | Shared test fixtures |
| Integration test setup (Testcontainers) | 2nd integration test | Shared container setup helper |

### Phase 3: Domain Models (when business logic gets complex)

A Drizzle row is just data. A domain model adds rules. You don't need domain models until the rules are too complex for a server action.

**Don't need a domain model:**
- Vehicle with id, name, plate number, capacity → just a Drizzle table
- Customer with id, name, email → just a Drizzle table

**Need a domain model:**
- Vehicle with maintenance schedule, temperature thresholds, driver assignment rules, capacity validation, reefer unit status → a `Vehicle` class or module with methods
- Order with state machine (drafted → submitted → in-transit → delivered), allowed transitions per role, line items, pricing rules → an `Order` module with transition logic
- Delivery with route optimization, time windows, temperature compliance checks → a `Delivery` module

**The signal:** when a server action has more than ~20 lines of business logic (not counting validation, permission checks, or database calls), that logic wants its own home.

### Phase 4: Cross-Cutting Modules (when infrastructure patterns repeat)

These emerge last because they span features.

| Module | Emerges when |
|---|---|
| Audit logging (generic `trackEvent`) | 3rd feature writes to its own event log → generalize |
| Notification system | 2nd feature sends notifications (email, push) → extract |
| File upload handling | 2nd feature handles file uploads → extract |
| Background job runner | 2nd feature needs async processing → extract |
| API client wrapper (for external services) | 2nd external service integration → extract |

## Testing Progression

Testing follows the same principle — extract when you repeat, not before.

### Phase 1: Inline Test Setup (where you are now)

Each test file sets up its own mocks and fixtures.

```
actions.test.ts → mocks Supabase, mocks db, mocks navigation
LoginForm.test.ts → mocks actions
migrations.integration.test.ts → starts container, runs migrations
```

This is correct. You don't know what the common patterns are yet.

### Phase 2: Shared Fixtures (after 3rd test file with same mocks)

When the third server action test file copies the same Supabase mock and db mock setup, extract:

| Shared fixture | Extracts from |
|---|---|
| `test/fixtures/supabase.ts` | Mock Supabase client used in every action test |
| `test/fixtures/db.ts` | Mock Drizzle client used in every action test |
| `test/fixtures/permissions.ts` | Mock withPermission used in every guarded action test |
| `test/fixtures/container.ts` | Testcontainers setup used in every integration test |

### Phase 3: Test Helpers (after complex domain logic)

When domain models have complex setup (an order with 5 line items in a specific state), create factory functions:

```
test/factories/order.ts → buildOrder({ status: 'submitted', lineItems: 3 })
test/factories/vehicle.ts → buildVehicle({ capacity: 5000, hasReefer: true })
```

Don't build factories until you're constructing the same test data for the third time.

### Phase 4: Custom Test Utilities (when testing patterns become unique)

- Custom matchers (`expect(order).toBeInState('submitted')`)
- Test database seeders for integration tests
- E2E page objects for Playwright

These appear when the volume of tests makes raw assertions hard to read.

## The Rule

**Write it inline. Notice the duplication. Extract the pattern. Never predict.**

If you're about to create a `BaseRepository`, `AbstractEntity`, `GenericService`, or `TestHelper` before you have three concrete implementations — stop. You're predicting, not extracting.
