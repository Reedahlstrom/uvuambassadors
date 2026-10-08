import "./_env";
import { closeDb, usingLocalDb } from "../src/lib/db";
import { runMigrations } from "../src/lib/db/migrate";
import { seedDemo } from "../src/lib/db/seed-demo";

async function main() {
  if (!usingLocalDb && !process.argv.includes("--yes-overwrite-real-database")) {
    console.error(
      "✗ Refusing to load demo data into DATABASE_URL (it would erase real data).\n" +
        "  Use `npm run db:admin -- \"Your Name\" you@uvu.edu` to create the first admin instead.",
    );
    process.exit(1);
  }
  await runMigrations();
  const r = await seedDemo();
  console.log(`✓ Demo data loaded: ${r.semester}, ${r.people} people, ${r.events} calendar items, ${r.signups} sign-ups`);
  await closeDb();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
