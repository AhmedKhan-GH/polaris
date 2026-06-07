// The test user is provisioned declaratively by the Keycloak realm import
// (keycloak/realm-export.json), so there is nothing to seed here. We only
// verify Keycloak is reachable so suites fail fast with a clear message.
export default async function globalSetup() {
  const issuer = process.env.AUTH_KEYCLOAK_ISSUER!
  const discovery = `${issuer}/.well-known/openid-configuration`

  const res = await fetch(discovery).catch((e) => {
    throw new Error(
      `Keycloak is not reachable at ${discovery}. Run \`docker compose up -d\` first. (${e})`,
    )
  })

  if (!res.ok) {
    throw new Error(`Keycloak discovery returned ${res.status} at ${discovery}`)
  }
}
