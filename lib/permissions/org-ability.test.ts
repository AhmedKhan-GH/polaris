// This file contains unit tests for the org ability matrix defined in org-ability.ts.
// These tests focus on verifying that the correct permissions are granted for org_admin and org_member roles, and that permissions are properly scoped to the organization.
// The tests use a fixed user ID and organization ID for simplicity, as the focus is on the role-based permissions rather than user or org variability.

// Command to run these tests: `npm run test -- lib/permissions/org-ability.test.ts`
import { subject } from "@casl/ability";
import { describe, expect, it } from "vitest";

import { defineOrgAbilityFor } from "./org-ability";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_ORG_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

// These tests are focused on the org role matrix, so we use a fixed user and org ID for simplicity.
describe("defineOrgAbilityFor", () => {
  it("grants org_admin the full org management matrix", () => {
    const ability = defineOrgAbilityFor("org_admin", USER_ID, ORG_ID);

    // Admin can manage the organization itself.
    expect(ability.can("manage", subject("Organization", { id: ORG_ID }))).toBe(
      true,
    );
    // Admin can manage org membership.
    expect(
      ability.can("manage", subject("Membership", { orgId: ORG_ID })),
    ).toBe(true);
    // Admin can use orders.
    expect(ability.can("create", subject("Order", { orgId: ORG_ID }))).toBe(
      true,
    );
    // Admin can also read orders.
    expect(ability.can("read", subject("Order", { orgId: ORG_ID }))).toBe(true);
  });
  // This test ensures that org_admin permissions are properly scoped to the organization, and do not leak into other organizations.
  it("keeps org_admin scoped to the selected organization", () => {
    const ability = defineOrgAbilityFor("org_admin", USER_ID, ORG_ID);

    // The same admin role should not leak into another org.
    expect(
      ability.can("manage", subject("Organization", { id: OTHER_ORG_ID })),
    ).toBe(false);
    // The same admin role should not leak into another org's membership.
    expect(
      ability.can("manage", subject("Membership", { orgId: OTHER_ORG_ID })),
    ).toBe(false);
    // The same admin role should not leak into another org's orders.
    expect(ability.can("read", subject("Order", { orgId: OTHER_ORG_ID }))).toBe(
      false,
    );
  });

  // This test ensures that org_member permissions are properly scoped to the organization, and do not leak into other organizations.
  it("grants org_member order access only", () => {
    const ability = defineOrgAbilityFor("org_member", USER_ID, ORG_ID);

    // Members can use orders.
    expect(ability.can("create", subject("Order", { orgId: ORG_ID }))).toBe(
      true,
    );
    // Members can also read orders.
    expect(ability.can("read", subject("Order", { orgId: ORG_ID }))).toBe(true);
    // Members cannot manage org settings or membership.
    expect(
      ability.can("manage", subject("Membership", { orgId: ORG_ID })),
    ).toBe(false);
    // Members cannot manage the organization itself.
    expect(ability.can("manage", subject("Organization", { id: ORG_ID }))).toBe(
      false,
    );
  });
  // This test ensures that users without an org role do not have any permissions in the organization.
  it("grants nothing without an org role", () => {
    // We pass null for the role to simulate a user without an org role.
    const ability = defineOrgAbilityFor(null, USER_ID, ORG_ID);

    // No role means no org permissions.
    expect(ability.can("manage", subject("Organization", { id: ORG_ID }))).toBe(
      false,
    );
    //  No role means no org permissions, even for membership.
    expect(
      ability.can("manage", subject("Membership", { orgId: ORG_ID })),
    ).toBe(false);
    // No role means no org permissions, even for orders.
    expect(ability.can("create", subject("Order", { orgId: ORG_ID }))).toBe(
      false,
    );
    // No role means no org permissions, even for reading orders.
    expect(ability.can("read", subject("Order", { orgId: ORG_ID }))).toBe(
      false,
    );
  });
});
