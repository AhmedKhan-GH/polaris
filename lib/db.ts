import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
// Side-effectful: parses DATABASE_URL via zod and self-loads .env.local
// for non-Next.js contexts before parsing.
import { serverEnv } from "./env";

export const db = drizzle(serverEnv!.DATABASE_URL, { schema });
