import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

config({ path: ".env.local" });

// Import is side-effectful: parses DATABASE_URL through zod and throws if missing/invalid.
import { serverEnv } from "./env";

export const db = drizzle(serverEnv!.DATABASE_URL, { schema });
