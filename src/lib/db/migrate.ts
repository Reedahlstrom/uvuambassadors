import path from "node:path";
import { getDb, usingLocalDb } from "./index";

/** Applies SQL migrations in /drizzle. Safe to run many times. */
export async function runMigrations() {
  const db = await getDb();
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (usingLocalDb) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db, { migrationsFolder });
  }
}
