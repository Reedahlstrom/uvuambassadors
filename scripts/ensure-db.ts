// Runs before `npm run dev`: applies migrations and, on the local demo database,
// loads demo data the first time so the app works with zero setup.
import "./_env";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { count } from "drizzle-orm";
import { closeDb, getDb, schema, usingLocalDb } from "../src/lib/db";
import { runMigrations } from "../src/lib/db/migrate";
import { seedDemo } from "../src/lib/db/seed-demo";

async function main() {
  try {
    await runMigrations();
  } catch (e) {
    if (!usingLocalDb) throw e;
    // The local demo database can get damaged if the dev server is killed mid-write.
    // It only holds demo data, so rebuild it.
    if (process.env.__UA_REBUILT) throw e;
    console.log("Local demo database was damaged — rebuilding it with fresh demo data…");
    fs.rmSync(path.join(process.cwd(), process.env.PGLITE_DIR || ".data"), { recursive: true, force: true });
    // Start over in a fresh process so nothing from the broken database lingers
    const r = spawnSync(process.execPath, process.execArgv.concat(process.argv.slice(1)), {
      stdio: "inherit",
      env: { ...process.env, __UA_REBUILT: "1" },
    });
    process.exit(r.status ?? 1);
  }
  if (usingLocalDb) {
    const db = await getDb();
    const [{ n }] = await db.select({ n: count() }).from(schema.users);
    if (n === 0) {
      const r = await seedDemo();
      console.log(`✓ Demo data loaded (${r.people} people, ${r.events} calendar items, ${r.signups} sign-ups)`);
    }
  }
  await closeDb();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
