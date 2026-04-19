import { randomUUID } from "node:crypto";
import { db } from "./db";
import { orders } from "./schema";

async function seed() {
  await db.insert(orders).values([
    { id: randomUUID() },
    { id: randomUUID() },
    { id: randomUUID() },
    { id: randomUUID() },
  ]);

  console.log("Seeded 4 orders.");
}

seed();
