This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## First-time setup

```bash
npm install

# Install Docker if needed:
#   macOS:   brew install --cask docker
#   Windows: winget install Docker.DockerDesktop
#   Linux:   curl -fsSL https://get.docker.com | sh

# Start Docker if needed:
#   macOS:   open -a Docker
#   Windows: start Docker Desktop from the Start menu
#   Linux:   sudo systemctl start docker

npx supabase start
```

Copy `.env.example` to `.env.local` and fill in the values printed by `npx supabase status`:

```bash
cp .env.example .env.local
```

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status>
```

Then run migrations and create your first user:

```bash
npm run db:migrate
npm run db:seed      # optional — seeds sample orders

# Create the bootstrap system user (creates auth user + profile in one step)
npx tsx scripts/create-user.ts <email> <password> system

npm run dev
```

Alternatively, you can create the auth user via curl and let the database trigger create the profile automatically (defaults to `member` role):

```bash
curl -s -X POST 'http://localhost:54321/auth/v1/admin/users' \
  -H 'apikey: <service_role key>' \
  -H 'Authorization: Bearer <service_role key>' \
  -H 'Content-Type: application/json' \
  -d '{"email":"<email>","password":"<password>","email_confirm":true}'
```

## Starting up again

```bash
npx supabase start     # if not already running
npm run dev            # runs db:migrate then starts the dev server
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

When you're done:

```bash
npx supabase stop
```

## Database

Uses [Drizzle ORM](https://orm.drizzle.team) with [Supabase](https://supabase.com) (Postgres). Schema is defined in `lib/schema.ts`.

```bash
# After editing lib/schema.ts:
npm run db:generate  # creates a new migration file in drizzle/
npm run db:migrate   # applies pending migrations to the database
```

## Roles

```
System          (out-of-band — platform bootstrap)
 └── Owner      (business owner — full control)
      └── Admin (manages staff)
           └── Member  (processes orders)
                └── Guest   (future — submits orders, sees only their own)
```

Each role can only create the tier directly below it. Guests can self-register; all other roles are created by a higher-tier user.

## Testing

```bash
npm test                     # unit tests
npm run test:integration     # explicit Testcontainers-backed integration tests
npm run test:e2e             # Playwright end-to-end tests
```

### E2E setup

E2E tests need a user in local Supabase Auth:

```bash
npx tsx scripts/create-user.ts <email> <password> member
```

Then add the credentials to `.env.local`:

```
E2E_TEST_EMAIL=<email>
E2E_TEST_PASSWORD=<password>
```

`supabase start` and `supabase stop` only manage the local Supabase stack. Integration tests manage their own Testcontainers lifecycle.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
