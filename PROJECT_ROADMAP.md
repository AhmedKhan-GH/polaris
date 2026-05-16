# Polaris Platform Roadmap

Breakdown of work to evolve Polaris from an order management tool into an all-in-one business platform (CRM, SKU, inventory, branding/marketing, logistics, asset tracking).

Each section is a project. Each bullet under "Issues" is a discrete GitHub issue that can be assigned independently.

---

## Phase 0 — Infrastructure & Foundations

These must land before new modules can be built cleanly.

---

### P0-1: App Shell & Navigation

**Why:** Currently there are only 4 routes and no persistent navigation. Every new module needs a sidebar/nav to be discoverable.

**Issues:**

- [ ] **Design and implement app shell layout** — persistent sidebar with collapsible nav, top bar with user menu, main content area. Should use a nested layout in `app/` so all authenticated routes inherit it.
- [ ] **Add module navigation items** — placeholder links for: Orders, Customers, Products, Inventory, Logistics, Assets, Marketing, Settings. Active state, icons, section grouping.
- [ ] **Mobile-responsive nav** — hamburger menu or drawer for mobile viewports.
- [ ] **Breadcrumb component** — reusable breadcrumb bar for nested pages (e.g., Customers > Acme Corp > Orders).

---

### P0-2: Middleware & Route Protection

**Why:** Auth checks are currently scattered across individual page components. A centralized middleware prevents unauthorized access consistently.

**Issues:**

- [ ] **Create middleware.ts** — intercept all requests, redirect unauthenticated users to `/login`, redirect users without profiles to `/no-access`.
- [ ] **Role-based route gating in middleware** — define which roles can access which route prefixes (e.g., `/settings` requires owner+, `/admin` requires system).
- [ ] **Protected API route pattern** — helper for server actions to verify role before executing.

---

### P0-3: Shared UI Primitives

**Why:** As modules grow, hand-rolling dropdowns/modals/toasts per feature won't scale.

**Issues:**

- [ ] **Toast/notification system** — global toast provider for success/error/info messages. Accessible, auto-dismiss, stackable.
- [ ] **Modal/dialog component** — reusable modal with title, body, footer actions. Trap focus, escape to close.
- [ ] **Dropdown menu component** — headless dropdown (Radix-based) for context menus and action menus.
- [ ] **Confirm dialog** — "Are you sure?" pattern as a reusable component (used in order transitions already, should be extracted).
- [ ] **Empty state component** — illustrated/placeholder component for when a list has no data yet.
- [ ] **Data table abstraction** — extract the ListTable pattern (TanStack Table + Virtual + pagination) into a reusable `<DataTable>` component with column config.

---

### P0-4: Multi-Tenancy Decision & Implementation

**Why:** If Polaris will serve multiple businesses or even departments, tenant isolation needs to be baked in now — retrofitting is painful.

**Issues:**

- [ ] **Research: tenant isolation strategy** — document trade-offs of (a) shared DB with `tenant_id` column, (b) schema-per-tenant, (c) DB-per-tenant. Recommend one for our scale.
- [ ] **Add `organizations` table** — id, name, slug, createdAt. Every entity gets an `org_id` FK.
- [ ] **Scope all queries by org** — repository layer filters by org context from session.
- [ ] **Update RLS policies** — enforce org-level row isolation at the database layer.
- [ ] **Org switcher UI** — if a user belongs to multiple orgs, allow switching in the nav.

---

### P0-5: Deployment & CI/CD

**Why:** No deployment pipeline exists. Can't ship to staging/production.

**Issues:**

- [ ] **Add deployment workflow** — GitHub Actions: build → test → deploy to Vercel/Railway/Fly (pick one).
- [ ] **Add E2E tests to CI** — run Playwright in CI against a test environment.
- [ ] **Add staging environment** — separate Supabase project + deployment target for pre-prod testing.
- [ ] **Health check endpoint** — `/api/health` that verifies DB connectivity, returns 200.
- [ ] **Error monitoring setup** — integrate Sentry or similar for runtime error tracking.

---

## Phase 1 — CRM (Customers & Contacts)

The backbone entity that Orders, Invoices, and Logistics all reference.

---

### P1-1: Customer Data Model

**Issues:**

- [ ] **Design customers table** — id, orgId, name, email, phone, company, type (individual/business), notes, createdAt, updatedAt.
- [ ] **Design contacts table** — id, customerId, name, email, phone, role/title, isPrimary, createdAt.
- [ ] **Create migrations** — generate and apply Drizzle migrations for both tables.
- [ ] **Customer repository** — CRUD operations, search by name/email, paginated list with cursor.
- [ ] **Link orders to customers** — add `customerId` FK to orders table, migration, update order repository.

---

### P1-2: Customer UI

**Issues:**

- [ ] **Customers list page** — `/customers` route with DataTable, search, pagination.
- [ ] **Customer detail page** — `/customers/[id]` showing profile, contacts, linked orders, activity timeline.
- [ ] **Create/edit customer form** — validated form with all fields, inline error messages.
- [ ] **Customer search/autocomplete** — reusable component for linking customers to orders and other entities.
- [ ] **Import customers from CSV** — bulk upload with validation, preview, and error reporting.

---

### P1-3: Communication History

**Issues:**

- [ ] **Design interactions table** — id, customerId, type (email/call/note/meeting), subject, body, createdBy, createdAt.
- [ ] **Interaction timeline UI** — chronological feed on customer detail page.
- [ ] **Add note form** — quick-add for internal notes on a customer.
- [ ] **Email integration research** — investigate connecting to email provider for automatic logging (future).

---

## Phase 2 — Products & SKU Catalog

---

### P2-1: Product Data Model

**Issues:**

- [ ] **Design products table** — id, orgId, name, sku, description, category, unitPrice, currency, isActive, createdAt, updatedAt.
- [ ] **Design product_categories table** — id, orgId, name, parentId (tree structure), sortOrder.
- [ ] **Design product_variants table** — id, productId, name, sku, attributes (jsonb), unitPrice override, isActive.
- [ ] **Create migrations** — generate and apply.
- [ ] **Product repository** — CRUD, search, filter by category, paginated list.

---

### P2-2: Product UI

**Issues:**

- [ ] **Products list page** — `/products` route with grid/list toggle, category filter, search.
- [ ] **Product detail page** — `/products/[id]` with variants, pricing, inventory summary.
- [ ] **Create/edit product form** — with image placeholder, variant management, category picker.
- [ ] **Category management UI** — tree view for creating/nesting categories.
- [ ] **SKU generator** — auto-generate SKU from category + product name pattern (configurable).

---

### P2-3: Order Line Items

**Issues:**

- [ ] **Design order_items table** — id, orderId, productId, variantId, quantity, unitPrice, totalPrice.
- [ ] **Migration + update order repository** — include line items in order queries.
- [ ] **Order form: add line items** — product picker, quantity, price calc.
- [ ] **Order detail: show line items** — table in sidebar/detail view with totals.

---

## Phase 3 — Inventory Management

---

### P3-1: Inventory Data Model

**Issues:**

- [ ] **Design warehouses table** — id, orgId, name, address, isActive.
- [ ] **Design inventory_levels table** — id, productId, variantId, warehouseId, quantity, reservedQuantity, reorderPoint.
- [ ] **Design stock_movements table** — id, productId, warehouseId, type (in/out/transfer/adjustment), quantity, reason, reference, createdBy, createdAt.
- [ ] **Create migrations**.
- [ ] **Inventory repository** — stock levels per product/warehouse, movement history, low-stock queries.

---

### P3-2: Inventory UI

**Issues:**

- [ ] **Inventory dashboard** — `/inventory` with stock levels overview, low-stock alerts, recent movements.
- [ ] **Stock adjustment form** — add/remove stock with reason, links to order or purchase.
- [ ] **Stock transfer form** — move inventory between warehouses.
- [ ] **Low-stock alerts** — visual indicators + configurable reorder point notifications.
- [ ] **Inventory history** — filterable movement log per product.

---

### P3-3: Order-Inventory Integration

**Issues:**

- [ ] **Reserve stock on order submission** — when order moves to "submitted", reserve inventory.
- [ ] **Release stock on discard/void** — when order is cancelled, release reserved stock.
- [ ] **Deduct stock on fulfillment** — when order ships, convert reserved to deducted.
- [ ] **Insufficient stock warnings** — prevent submission if stock unavailable.

---

## Phase 4 — Logistics & Fulfillment

---

### P4-1: Logistics Data Model

**Issues:**

- [ ] **Design shipments table** — id, orderId, carrier, trackingNumber, status, shippedAt, deliveredAt, estimatedDelivery.
- [ ] **Design shipment_items table** — id, shipmentId, orderItemId, quantity (partial shipments).
- [ ] **Design carriers table** — id, orgId, name, trackingUrlTemplate, isActive.
- [ ] **Create migrations**.
- [ ] **Shipment repository** — CRUD, status updates, tracking lookup.

---

### P4-2: Logistics UI

**Issues:**

- [ ] **Shipments list page** — `/logistics` with status filters, carrier filter, date range.
- [ ] **Create shipment form** — select order, pick items to ship, enter tracking info.
- [ ] **Shipment tracking view** — timeline of status updates, link to carrier tracking page.
- [ ] **Order detail: shipment status** — show fulfillment progress on order sidebar.
- [ ] **Bulk shipping** — select multiple orders, generate shipments in batch.

---

### P4-3: Carrier Integration (Future)

**Issues:**

- [ ] **Research carrier APIs** — document available integrations (UPS, FedEx, USPS, etc.).
- [ ] **Tracking webhook receiver** — endpoint to receive status updates from carriers.
- [ ] **Rate shopping** — compare shipping rates across carriers for an order.

---

## Phase 5 — Asset Tracking

---

### P5-1: Asset Data Model

**Issues:**

- [ ] **Design assets table** — id, orgId, name, type, serialNumber, status (available/in-use/maintenance/retired), location, assignedTo, purchaseDate, value, notes.
- [ ] **Design asset_types table** — id, orgId, name, fields (jsonb for custom attributes).
- [ ] **Design asset_history table** — id, assetId, event (assigned/returned/maintained/moved), details, createdBy, createdAt.
- [ ] **Create migrations**.
- [ ] **Asset repository** — CRUD, search, filter by type/status/location.

---

### P5-2: Asset UI

**Issues:**

- [ ] **Assets list page** — `/assets` with type/status filters, search, grid/list view.
- [ ] **Asset detail page** — `/assets/[id]` with history timeline, current assignment, maintenance log.
- [ ] **Check out / check in flow** — assign asset to person/location, record return.
- [ ] **Maintenance scheduling** — log maintenance events, set next-due reminders.
- [ ] **QR/barcode generation** — generate printable labels for physical assets.

---

## Phase 6 — Branding & Marketing

---

### P6-1: Brand Asset Management

**Issues:**

- [ ] **Design brand_assets table** — id, orgId, name, type (logo/font/color/template/photo), fileUrl, metadata (jsonb), tags, createdBy, createdAt.
- [ ] **File upload integration** — wire up Supabase Storage for brand asset uploads (images, PDFs, fonts).
- [ ] **Brand assets library UI** — `/marketing/assets` with grid view, type filter, tag filter, search.
- [ ] **Asset detail/preview** — image preview, download, usage history.

---

### P6-2: Campaign Tracking

**Issues:**

- [ ] **Design campaigns table** — id, orgId, name, status (draft/active/paused/completed), channel, startDate, endDate, budget, notes.
- [ ] **Campaign list page** — `/marketing/campaigns` with status filter, date range.
- [ ] **Campaign detail page** — overview, linked assets, notes, performance placeholder.
- [ ] **Campaign calendar view** — monthly calendar showing active/upcoming campaigns.

---

## Phase 7 — Platform Polish

---

### P7-1: Search & Discovery

**Issues:**

- [ ] **Global search** — cmd+K / ctrl+K palette that searches across all entities (customers, orders, products, assets).
- [ ] **Recent items** — track and display recently viewed entities per user.
- [ ] **Saved filters/views** — allow users to save filter presets on any list page.

---

### P7-2: Activity & Audit

**Issues:**

- [ ] **Unified activity feed** — cross-module activity log (order created, customer updated, stock adjusted, etc.).
- [ ] **User activity dashboard** — for admins to see team activity.
- [ ] **Export audit log** — CSV/JSON export of activity for compliance.

---

### P7-3: Notifications & Automation

**Issues:**

- [ ] **In-app notifications** — bell icon with unread count, notification drawer.
- [ ] **Email notifications** — configurable triggers (low stock, order status change, assignment).
- [ ] **Webhook system** — allow external systems to subscribe to events.

---

### P7-4: Reporting & Analytics

**Issues:**

- [ ] **Dashboard home** — KPI cards (total orders, revenue, stock value, active campaigns).
- [ ] **Orders report** — orders over time, by status, by customer.
- [ ] **Inventory report** — stock value, turnover, dead stock.
- [ ] **Exportable reports** — PDF/CSV generation for any report.

---

## How to Use This Document

1. **Create a GitHub Project board** with columns: Backlog, In Progress, Review, Done.
2. **Create issues from each `[ ]` bullet** — use the project header as a label (e.g., `P0-infra`, `P1-crm`, `P2-products`).
3. **Assign by phase** — interns can work on P0 items in parallel, then P1-P2 once foundations land.
4. **Each issue should include:**
   - The bullet text as the title
   - The "Why" from the project section as context
   - Acceptance criteria (what does "done" look like)
   - Dependencies (which issues must land first)

### Suggested Intern Assignments

| Focus Area | Skills Needed |
|------------|---------------|
| P0-1, P0-3 (App Shell, UI Primitives) | Frontend, Tailwind, React |
| P0-2, P0-4 (Middleware, Multi-tenancy) | Backend, Supabase, PostgreSQL |
| P0-5 (CI/CD) | DevOps, GitHub Actions |
| P1 (CRM) | Full-stack, forms, data modeling |
| P2 (Products) | Full-stack, forms, data modeling |
| P3 (Inventory) | Backend-heavy, business logic |
| P4 (Logistics) | Backend, external APIs |
| P5 (Assets) | Full-stack |
| P6 (Marketing) | Frontend-heavy, file uploads |
