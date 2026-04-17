This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## First-time setup

```bash
npm install

# Start Supabase locally (requires Docker)
npx supabase start

# Add the printed DB URL to .env.local:
# DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

npm run db:migrate
npm run db:seed      # optional
npm run dev
```

## Starting up again

```bash
npx supabase start   # if not already running
npm run dev          # runs db:migrate then starts the dev server
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

## Database

Uses [Drizzle ORM](https://orm.drizzle.team) with [Supabase](https://supabase.com) (Postgres). Schema is defined in `lib/schema.ts`.

```bash
npm run db:generate  # generate migrations from schema changes
npm run db:migrate   # apply migrations
npm run db:studio    # open Drizzle Studio
npm run db:seed      # seed the database
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
