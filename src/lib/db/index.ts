import path from "node:path";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Database connection.
 *
 * - DATABASE_URL set   → real Postgres (Supabase, Neon, Vercel Postgres, ...)
 * - DATABASE_URL empty → local demo database (PGlite, stored in ./.data) so the
 *                        app runs with zero setup.
 */
export type DB = PostgresJsDatabase<typeof schema>;

export const usingLocalDb = !process.env.DATABASE_URL;

const globalForDb = globalThis as unknown as { __db?: DB; __pglite?: { close: () => Promise<void> } };

async function createLocalDb(): Promise<DB> {
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. Add your Postgres connection string in the environment variables.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const fs = await import("node:fs");
  const dir = path.join(process.cwd(), process.env.PGLITE_DIR || ".data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  globalForDb.__pglite = client;
  // Close the local database cleanly on Ctrl+C so its files don't get damaged.
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.once(sig, () => {
      client.close().finally(() => process.exit(0));
    });
  }
  return drizzle(client, { schema }) as unknown as DB;
}

function createRemoteDb(): DB {
  const client = postgres(process.env.DATABASE_URL!, {
    // Serverless (Vercel): one connection per instance, the pooler does the rest
    max: process.env.VERCEL ? 1 : 5,
    // Supabase/Neon poolers in transaction mode don't support prepared statements
    prepare: false,
  });
  return drizzlePostgres(client, { schema });
}

let pending: Promise<DB> | null = null;

export async function getDb(): Promise<DB> {
  if (globalForDb.__db) return globalForDb.__db;
  if (!pending) {
    pending = (usingLocalDb ? createLocalDb() : Promise.resolve(createRemoteDb())).then((db) => {
      globalForDb.__db = db;
      return db;
    });
  }
  return pending;
}

export async function closeDb() {
  try {
    if (globalForDb.__pglite) await globalForDb.__pglite.close();
  } finally {
    globalForDb.__db = undefined;
    globalForDb.__pglite = undefined;
    pending = null;
  }
}

export { schema };
