// Ability composition root (Domain Charter §3) — a FLAT list with ZERO logic.
//
// This is the one place where feature authorization contributors are wired into
// the foundation's `buildAbility` seam. It is intentionally empty: the system is
// fail-closed, so until a feature registers a contributor here, authorization
// grants nothing. Adding a rule is a single, reviewable line in this file —
// never a hidden edit inside the foundation.
//
// NOTE: this file imports only the `AbilityContributor` *type* from
// lib/permissions (an intra-lib edge, always legal). When features exist, their
// `permissions` manifests will be imported here too; the Rule-C scanner permits
// registry → feature `permissions`/`schema`/`nav` imports for exactly that.

import { activityAbilities } from '@/app/_features/activity/permissions';
import { notesAbilities } from '@/app/_features/notes/permissions';
import { ordersAbilities } from '@/app/_features/orders/permissions';
import { productsAbilities } from '@/app/_features/products/permissions';
import type { AbilityContributor } from '@/lib/permissions/ability';

export const abilityContributors: AbilityContributor[] = [
  activityAbilities,
  notesAbilities,
  productsAbilities,
  ordersAbilities,
];
