import "server-only";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb, schema } from "./db";
import type { Semester, User } from "./db/schema";
import { addDays, utahToDate } from "./dates";
import { semesterElapsed, statusOf, tally, type Reqs, type Status, type Tally } from "./progress";

export async function getSemester(): Promise<Semester> {
  const db = await getDb();
  const [current] = await db.select().from(schema.semesters).where(eq(schema.semesters.isCurrent, true)).limit(1);
  if (current) return current;
  const [latest] = await db.select().from(schema.semesters).orderBy(desc(schema.semesters.startsOn)).limit(1);
  if (latest) return latest;
  const y = new Date().getFullYear();
  const [created] = await db
    .insert(schema.semesters)
    .values({ name: `Fall ${y}`, startsOn: `${y}-08-24`, endsOn: `${y}-12-11`, isCurrent: true })
    .returning();
  return created;
}

export function reqsOf(s: Semester): Reqs {
  return { tour: s.reqTours, event: s.reqEvents, hs_visit: s.reqHsVisits, hs_visit_ac: s.reqHsVisitsAc };
}

export function semesterRange(s: Semester) {
  return { from: utahToDate(s.startsOn), to: utahToDate(addDays(s.endsOn, 1)) };
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const db = await getDb();
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string) {
  const db = await getDb();
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

// ---------- Calendar ----------

export type CalEvent = {
  id: string;
  title: string;
  type: "tour" | "event" | "hs_visit" | "calendar";
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  spots: number | null;
  withAc: boolean;
  source: "app" | "outlook";
  people: { id: string; name: string; status: "going" | "no_show" }[];
};

/** Everything on the calendar from 2 weeks before the semester to 2 months after. */
export async function getCalendarEvents(s: Semester): Promise<CalEvent[]> {
  const db = await getDb();
  const from = utahToDate(addDays(s.startsOn, -14));
  const to = utahToDate(addDays(s.endsOn, 60));
  const rows = await db
    .select()
    .from(schema.events)
    .where(and(gte(schema.events.endsAt, from), lt(schema.events.startsAt, to)))
    .orderBy(asc(schema.events.startsAt));
  const ids = rows.map((r) => r.id);
  const people = ids.length
    ? await db
        .select({
          eventId: schema.signups.eventId,
          userId: schema.users.id,
          name: schema.users.name,
          status: schema.signups.status,
        })
        .from(schema.signups)
        .innerJoin(schema.users, eq(schema.users.id, schema.signups.userId))
        .where(inArray(schema.signups.eventId, ids))
        .orderBy(asc(schema.signups.createdAt))
    : [];
  const byEvent = new Map<string, CalEvent["people"]>();
  for (const p of people) {
    const list = byEvent.get(p.eventId) ?? [];
    list.push({ id: p.userId, name: p.name, status: p.status });
    byEvent.set(p.eventId, list);
  }
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
    allDay: r.allDay,
    location: r.location,
    notes: r.notes,
    spots: r.spots,
    withAc: r.withAc,
    source: r.source,
    people: byEvent.get(r.id) ?? [],
  }));
}

// ---------- Progress ----------

export type PersonProgress = {
  id: string;
  name: string;
  email: string;
  role: User["role"];
  teamId: string | null;
  teamName: string | null;
  tally: Tally;
  status: Status;
  total: number;
  neverLoggedIn: boolean;
};

export async function getProgress(opts: { teamId?: string; userIds?: string[] } = {}): Promise<PersonProgress[]> {
  const db = await getDb();
  const s = await getSemester();
  const reqs = reqsOf(s);
  const { from, to } = semesterRange(s);
  const elapsed = semesterElapsed(s.startsOn, s.endsOn);

  const conds = [eq(schema.users.active, true), eq(schema.users.role, "ambassador")];
  if (opts.teamId) conds.push(eq(schema.users.teamId, opts.teamId));
  if (opts.userIds) conds.push(inArray(schema.users.id, opts.userIds.length ? opts.userIds : ["00000000-0000-0000-0000-000000000000"]));

  const people = await db
    .select({ user: schema.users, teamName: schema.teams.name })
    .from(schema.users)
    .leftJoin(schema.teams, eq(schema.teams.id, schema.users.teamId))
    .where(and(...conds))
    .orderBy(asc(schema.users.name));
  if (people.length === 0) return [];

  const rows = await db
    .select({
      userId: schema.signups.userId,
      status: schema.signups.status,
      type: schema.events.type,
      withAc: schema.events.withAc,
      endsAt: schema.events.endsAt,
    })
    .from(schema.signups)
    .innerJoin(schema.events, eq(schema.events.id, schema.signups.eventId))
    .where(
      and(
        inArray(
          schema.signups.userId,
          people.map((p) => p.user.id),
        ),
        gte(schema.events.startsAt, from),
        lt(schema.events.startsAt, to),
      ),
    );
  const byUser = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byUser.get(r.userId) ?? [];
    list.push(r);
    byUser.set(r.userId, list);
  }

  return people.map(({ user, teamName }) => {
    const list = byUser.get(user.id) ?? [];
    const t = tally(list);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      teamId: user.teamId,
      teamName,
      tally: t,
      status: statusOf(t, reqs, elapsed),
      total: list.filter((l) => l.type !== "calendar").length,
      neverLoggedIn: !user.lastLoginAt,
    };
  });
}

export async function getTeams() {
  const db = await getDb();
  return db
    .select({ id: schema.teams.id, name: schema.teams.name, managerId: schema.teams.managerId, managerName: schema.users.name })
    .from(schema.teams)
    .leftJoin(schema.users, eq(schema.users.id, schema.teams.managerId))
    .orderBy(asc(schema.teams.name));
}
