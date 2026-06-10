// Navigation composition root (Domain Charter §3) — a FLAT list with ZERO logic.
//
// This is the one place where feature navigation entries are wired into the
// dashboard chrome. It is data only: no component, no filtering, no imports of
// app code today. An entry may carry a `permission` gate; the dashboard renders
// each entry only when the caller's ability grants that action on that subject
// (entries without a gate are always shown). Mirrors the ability registry: until
// a feature adds a line here, the dashboard shows zero feature links.
//
// NOTE: lives under lib/registry/ so it stays importable by both the foundation
// and feature code without crossing the lib -> app boundary. Feature `nav`
// manifests are imported here (the Rule-C scanner permits registry -> feature
// `nav` imports for exactly this); each manifest imports back only the `NavItem`
// *type*, an erased edge that creates no runtime cycle.

import { activityNav } from '@/app/_features/activity/nav';

/** A single dashboard navigation entry. `permission`, when present, gates it. */
export type NavItem = {
  label: string;
  href: string;
  permission?: { action: string; subject: string };
};

export const navItems: NavItem[] = [activityNav];
