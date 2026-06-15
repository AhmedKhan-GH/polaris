// This file defines the org-level ability matrix for users based on their role within an organization.
// It uses CASL to define permissions for 'org_admin' and 'org_member' roles, scoped to a specific organization.
// The abilities defined here will be used in the application to enforce access control for organizational resources such as orders, memberships, and organization settings.

import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from "@casl/ability";

export type OrgRole = "org_admin" | "org_member" | null | undefined;

export type OrgAbility = MongoAbility;

// Pure org-role rules for one selected organization.
export function defineOrgAbilityFor(
  orgRole: OrgRole,
  userId: string,
  orgId: string,
): OrgAbility {
  const { can, build } = new AbilityBuilder(createMongoAbility);

  // Keep userId in the signature for IAM 6/9, where row conditions will need it. (Future Proofing)
  void userId;
  // If the user is an org admin, they can manage everything in the org. If they're a member, they can only work with orders. If they have no role, they have no permissions.
  if (orgRole === "org_admin") {
    // Admins can manage the org and its people.
    can("manage", "Organization", { id: orgId });
    can("manage", "Membership", { orgId });
    // Admins can also work with orders in this org.
    can(["create", "read"], "Order", { orgId });
  }

  if (orgRole === "org_member") {
    // Members can work with orders, but not org settings or members.
    can(["create", "read"], "Order", { orgId });
  }

  return build();
}
