// Usage: PGLITE_DIR=.data-real npx tsx scripts/import-signupgenius.ts
// Loads SignUpGenius slots + sign-ups from data-private/ (gitignored: real names) into the database.
// Safe to re-run: people match by name, events by SignUpGenius slot id.
import "./_env";
import crypto from "node:crypto";
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { closeDb, getDb, schema } from "../src/lib/db";
import { runMigrations } from "../src/lib/db/migrate";
import { addDays, utahToDate } from "../src/lib/dates";

type Slot = { kind: "tour" | "oncampus" | "social"; sid: number; title: string; comment: string; location: string; start: string; end: string | null; qty: number; names: string[] };
type Roster = {
  semester: { name: string; startsOn: string; endsOn: string };
  aliases: Record<string, string>;
  emails: Record<string, string>;
  admins: string[];
  managers: string[];
  ambassadors: string[];
  fixTimes: Record<string, { start?: string; end?: string }>;
};

const slots: Slot[] = JSON.parse(fs.readFileSync("data-private/signupgenius.json", "utf8"));
const roster: Roster = JSON.parse(fs.readFileSync("data-private/roster.json", "utf8"));
const canon = (n: string) => roster.aliases[n.trim()] ?? n.trim();
// Placeholder until real emails are known (.invalid can never receive mail)
const emailFor = (name: string) =>
  roster.emails[name] ?? name.toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").trim().replace(/ +/g, ".") + "@needs-email.invalid";
const token = () => crypto.randomBytes(18).toString("base64url");

async function main() {
  await runMigrations();
  const db = await getDb();

  // Semester + settings
  const [sem] = await db.select().from(schema.semesters).where(eq(schema.semesters.isCurrent, true));
  if (sem) await db.update(schema.semesters).set(roster.semester).where(eq(schema.semesters.id, sem.id));
  else await db.insert(schema.semesters).values({ ...roster.semester, isCurrent: true });
  for (const [key, value] of [["outlook_ics_url", ""], ["auto_shift_reminders", "true"], ["auto_weekly_nudges", "false"]]) {
    await db.insert(schema.settings).values({ key, value }).onConflictDoNothing();
  }

  // People
  const role = (n: string) => (roster.admins.includes(n) ? "admin" : roster.managers.includes(n) ? "manager" : "ambassador");
  const names = new Set([...roster.admins, ...roster.managers, ...roster.ambassadors, ...slots.flatMap((s) => s.names.map(canon))]);
  const byName = new Map<string, string>();
  for (const u of await db.select().from(schema.users)) byName.set(u.name, u.id);
  for (const name of names) {
    if (byName.has(name)) {
      await db.update(schema.users).set({ role: role(name) }).where(eq(schema.users.id, byName.get(name)!));
      continue;
    }
    const [u] = await db.insert(schema.users).values({ name, email: emailFor(name), role: role(name), calendarToken: token() }).returning();
    byName.set(name, u.id);
  }

  // One team per manager
  const teams = await db.select().from(schema.teams);
  for (const m of roster.managers) {
    const id = byName.get(m)!;
    if (teams.some((t) => t.managerId === id)) continue;
    const [t] = await db.insert(schema.teams).values({ name: `${m.split(" ")[0]}'s team`, managerId: id }).returning();
    await db.update(schema.users).set({ teamId: t.id }).where(eq(schema.users.id, id));
  }

  // Events + sign-ups
  let events = 0, signups = 0;
  for (const s of slots) {
    const date = s.start.slice(0, 10);
    const fix = roster.fixTimes[`${s.title}@${date}`] ?? roster.fixTimes[s.title] ?? {};
    const startT = fix.start ?? s.start.slice(11, 16);
    const endT = fix.end ?? s.end?.slice(11, 16);
    const isSocial = s.kind === "social";
    const values = {
      title: isSocial ? `Social media · ${s.title}` : s.title,
      type: s.kind === "tour" ? ("tour" as const) : ("event" as const),
      startsAt: utahToDate(date, isSocial ? "00:00" : startT),
      endsAt: isSocial ? utahToDate(addDays(date, 5)) : utahToDate(date, endT),
      allDay: isSocial,
      location: s.location || null,
      notes: s.comment || null,
      spots: Number(s.qty) || null,
      externalId: `sug:${s.sid}`,
      updatedAt: new Date(),
    };
    const [e] = await db
      .insert(schema.events)
      .values(values)
      .onConflictDoUpdate({ target: schema.events.externalId, set: values })
      .returning();
    events++;
    for (const n of new Set(s.names.map(canon))) {
      const r = await db.insert(schema.signups).values({ eventId: e.id, userId: byName.get(n)! }).onConflictDoNothing().returning();
      signups += r.length;
    }
  }
  console.log(`✓ ${names.size} people, ${events} events, ${signups} new sign-ups`);
  await closeDb();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
