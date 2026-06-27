# Polaris: Public-Facing Cold Chain Logistics Service

## Vision

Polaris becomes a public-facing platform for small parcel cold chain logistics in the San Francisco Bay Area. Businesses that ship temperature-sensitive goods (food, pharmaceuticals, biotech samples, floral) can create accounts, submit shipments, and track their parcels through the cold chain in real time.

## Target Market

- Small-to-mid food producers (meal prep, specialty groceries, DTC perishables)
- Local pharmaceutical distributors and compounding pharmacies
- Biotech labs shipping samples between Bay Area facilities
- Floral and agricultural producers serving local restaurants and retailers
- Catering companies with multi-drop cold deliveries

## Core Service Offering

### What we handle

- Last-mile and mid-mile cold chain delivery within the Bay Area
- Temperature-monitored small parcel transport (under 50 lbs per parcel)
- Proof of temperature compliance throughout transit
- Scheduled recurring pickups and on-demand dispatch

### What differentiates us

- Real-time temperature telemetry visible to the shipper
- Chain-of-custody audit trail (who handled it, when, at what temp)
- Compliance-ready logs for FDA, FSMA, and CDFA requirements
- Self-service platform — no phone calls, no email chains

## Platform Capabilities (public-facing)

### For shippers (customers)

- Self-service account creation and onboarding
- Submit shipments: origin, destination, temperature requirements, time windows
- Real-time tracking dashboard with temperature graphs
- Delivery confirmation with photo proof and temp logs
- Billing and invoicing portal
- API access for programmatic shipment submission

### For operations (internal)

- Route optimization across temperature zones
- Driver dispatch and assignment
- Cold chain exception alerts (temperature breach notifications)
- Fleet capacity planning
- SLA monitoring and reporting

## Compliance and Trust

- FSMA (Food Safety Modernization Act) compliant record-keeping
- CDFA (California Dept of Food and Agriculture) transport requirements
- Temperature deviation incident reports generated automatically
- Exportable audit logs per shipment for customer compliance teams

## Revenue Model

- Per-parcel delivery fee (distance + weight + temperature tier)
- Monthly subscription for recurring pickup schedules
- Premium tier: dedicated routes, priority dispatch, custom SLA
- API access fee for high-volume integrators

## Geographic Scope

Phase 1: San Francisco, Oakland, San Jose triangle (core Bay Area)
Phase 2: Expand to broader Northern California (Sacramento, Santa Cruz, Napa/Sonoma)
Phase 3: Southern California and inter-city corridors

## Technical Implications for Polaris

### What changes from internal tool to public platform

| Concern | Internal | Public-facing |
|---------|----------|---------------|
| Auth | Admin-created accounts | Self-service registration + OAuth |
| Multi-tenancy | Single org | Isolated customer orgs |
| Permissions | Role-based (owner/admin/member) | Org-scoped + customer portal roles |
| Data isolation | Shared tables | RLS per organization |
| API | None | Public REST/webhook API for integrators |
| Billing | None | Stripe integration, usage metering |
| Compliance | Internal logs | Customer-facing audit exports |
| Uptime | Best effort | SLA-backed, status page |

### Features to unshelve

- User-facing registration (currently shelved)
- OAuth (Google login for business accounts)
- Email verification and password reset flows

### New features required

- Organization/tenant model (multi-tenancy)
- Customer onboarding flow (company info, billing, first shipment)
- Shipment submission and tracking UI
- Temperature telemetry ingestion and visualization
- Driver/courier mobile interface
- Billing integration (Stripe)
- Public API with key management
- Notification system (email, SMS, webhook)
- Status page and uptime monitoring
