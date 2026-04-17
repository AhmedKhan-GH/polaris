import { db } from "./db";
import { posts } from "./schema";

async function seed() {
  await db.insert(posts).values([
    { title: "Getting Started with Drizzle", content: "Drizzle ORM is a TypeScript ORM that feels like writing SQL." },
    { title: "Server Components & Databases", content: "Next.js Server Components can query databases directly — no API layer needed." },
    { title: "SQLite for Development", content: "SQLite is a great choice for local development — zero config, file-based, and fast." },
  ]);

  console.log("Seeded 3 posts.");
}

seed();
