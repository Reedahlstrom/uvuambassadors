import "./_env";
import { closeDb, usingLocalDb } from "../src/lib/db";
import { runMigrations } from "../src/lib/db/migrate";

async function main() {
  console.log(usingLocalDb ? "→ Local demo database (.data/pglite)" : "→ DATABASE_URL");
  await runMigrations();
  console.log("✓ Database is up to date");
  await closeDb();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
