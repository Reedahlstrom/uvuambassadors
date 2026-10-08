// Usage: npm run db:admin -- "Full Name" name@uvu.edu
import "./_env";
import crypto from "node:crypto";
import { count, eq } from "drizzle-orm";
import { closeDb, getDb, schema } from "../src/lib/db";
import { runMigrations } from "../src/lib/db/migrate";

async function main() {
  const [name, rawEmail] = process.argv.slice(2);
  if (!name || !rawEmail) {
    console.error('Usage: npm run db:admin -- "Full Name" name@uvu.edu');
    process.exit(1);
  }
  const email = rawEmail.trim().toLowerCase();
  await runMigrations();
  const db = await getDb();

  const existing = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (existing.length) {
    await db.update(schema.users).set({ role: "admin", active: true }).where(eq(schema.users.email, email));
    console.log(`✓ ${email} is now an admin`);
  } else {
    await db.insert(schema.users).values({ name, email, role: "admin", calendarToken: crypto.randomBytes(18).toString("base64url") });
    console.log(`✓ Created admin ${name} <${email}>`);
  }

  const [{ n }] = await db.select({ n: count() }).from(schema.semesters);
  if (n === 0) {
    const y = new Date().getFullYear();
    await db.insert(schema.semesters).values({ name: `Fall ${y}`, startsOn: `${y}-08-24`, endsOn: `${y}-12-11`, isCurrent: true });
    console.log(`✓ Created semester "Fall ${y}" — change dates in Admin → Settings`);
  }
  await closeDb();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
