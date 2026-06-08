import { z } from 'zod'

// Shared field shapes for the Keycloak provider env. PURE (no process.env access)
// so it's safe to import from BOTH the edge auth.config and the node env-auth.
// The edge/node split forces separate *parse* calls (the edge can't run a dynamic
// process.env parse) — only the field *rules* are shared here, so there's one
// source of truth for "what a valid Keycloak env looks like."
export const keycloakEnvFields = {
  AUTH_KEYCLOAK_ID: z.string().min(1),
  AUTH_KEYCLOAK_SECRET: z.string().min(1),
  AUTH_KEYCLOAK_ISSUER: z.string().url(),
}
