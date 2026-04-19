import { randomUUID } from "node:crypto";
import { db } from "./db";
import { log } from "./log";
import { orders } from "./schema";

async function seed() {
  const count = 4;
  await db.insert(orders).values(
    Array.from({ length: count }, () => ({ id: randomUUID() })),
  );

  log.info({ count }, "seeded orders");
}

seed();
