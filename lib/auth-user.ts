// Minimal user shape the UI needs, decoupled from any auth provider.
export type AuthUser = {
  name?: string | null
  email?: string | null
  image?: string | null
}
