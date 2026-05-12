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

# Add the printed DB URL to .env.local:
# DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

npm run db:migrate
npm run db:seed      # optional — seeds sample orders

# Create the system user (use the secret key from `npx supabase status`)
curl -s -X POST 'http://localhost:54321/auth/v1/admin/users' \
  -H 'apikey: <secret-key>' \
  -H 'Authorization: Bearer <secret-key>' \
  -H 'Content-Type: application/json' \
  -d '{"email":"<email>","password":"<password>","email_confirm":true}'

npm run dev
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

Each role can only create the tier directly below it. Signup is disabled — all users are invited except guests (future).

## Testing

```bash
npm test                     # unit tests
npm run test:integration     # explicit Testcontainers-backed integration tests
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
