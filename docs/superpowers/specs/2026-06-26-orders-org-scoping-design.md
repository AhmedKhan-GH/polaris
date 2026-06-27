# Orders — Org-Scoping (`org_id`) — Design

> **Status:** brainstorming → pre-design (promoted 2026-06-26).
> The orders access-control model that replaces the temporary open-read
> (`orders_read_all`): orders scoped to organizations, with org membership and
> ownership driving CASL + RLS. The MVP access-control gap. Flesh into a full
> design spec before the F9 (org/owner) / F12 (customer-scoped RLS) build.

## Brainstorming notes (verbatim)

as of now I will have orders that are scoped to organizations
organizations are created by the first user and they can invite
other users or customers create individual organizations

org owners can elevate another to the level of owner which
can then demote the existing for owner transfer, such that we
will have last-owner protection just like we will have
at the polaris platform level

orders are assigned to organizations (as these are the entities
that are billed, the address they have for delivery, carrying
the information for the CRM system)

- users without customer orgs can only create a new org, be
invited to an existing org by the platform owner or an org owner,
or be placed in an org by the platform owner

therefore the order schema has an org_id column and a user_id column
which indicates which org it is tied to (who can see it) and the specific
user that created the order when logged into the account, this may be a company
staff who created the order over the phone with the customre or the customer
creating the order over the website

then casl and RLS permissins need to ensure that sufficiently permitted users
can create an edit in an org vs just view only, and that such edit and read
is only scoped to that org

(I am still debating an eventual multi tenancy functionality in polaris where
different logistics networks create create their own order scoping and logistics
but this will be a much larger challenge)
