import crypto from "node:crypto";
import { addDays, todayKey, utahToDate, weekdayOf } from "../dates";
import { getDb, schema } from "./index";
import { DEMO_EMAILS } from "../config";

/**
 * Fake demo data: 4 admins, 6 managers with a team each, 40 ambassadors,
 * a full semester of tours / events / high school visits / Outlook items, and sign-ups.
 * Emails use @example.com so nothing real can ever be emailed.
 */

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261006);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const FIRST = [
  "Jordan", "Ashley", "Tyler", "Megan", "Ethan", "Kaitlyn", "Spencer", "Brooke", "Isaac", "Hannah",
  "Caleb", "Abby", "Logan", "Emma", "Mason", "Lauren", "Bridger", "Sadie", "Carter", "Ellie",
  "Dallin", "Madison", "Parker", "Olivia", "Jacob", "Kenzie", "Ty", "Natalie", "Sam", "Grace",
  "Bryson", "Lily", "Hunter", "Camila", "Lucas", "Sofia", "Gavin", "Avery", "Mateo", "Rachel",
  "Nathan", "Chloe", "Owen", "Jenna", "Eli", "Taylor", "Andrew", "Mia", "Josh", "Kate",
];
const LAST = [
  "Lee", "Jensen", "Christensen", "Peterson", "Larsen", "Nielsen", "Hansen", "Anderson", "Smith", "Young",
  "Allen", "Hall", "Wright", "Morales", "Garcia", "Walker", "Bennett", "Cox", "Baker", "Hughes",
  "Ramirez", "Fisher", "Barnes", "Price", "Ward", "Rivera", "Bowen", "Ellis", "Tanner", "Stewart",
  "Harris", "Murphy", "Reyes", "Foster", "Sorensen", "Rasmussen", "Clark", "Ortiz", "Lund", "Pratt",
];
const SCHOOLS = [
  "Orem High", "Mountain View High", "Timpanogos High", "Lone Peak High", "American Fork High", "Lehi High",
  "Skyridge High", "Westlake High", "Pleasant Grove High", "Spanish Fork High", "Salem Hills High",
  "Maple Mountain High", "Provo High", "Timpview High", "Springville High", "Payson High", "Wasatch High",
  "Park City High", "Cedar Valley High", "Corner Canyon High",
];
const EVENT_NAMES = [
  ["Preview Day", "Sorensen Student Center"],
  ["Scholarship Night", "Ragan Theater"],
  ["Parent Night", "Grande Ballroom"],
  ["Majors Fair", "Sorensen Student Center"],
  ["Transfer Day", "Admissions"],
  ["Game Day Tours", "UCCU Center"],
  ["Admitted Students Reception", "Grande Ballroom"],
  ["Concurrent Enrollment Night", "Fulton Library"],
  ["Campus Open House", "Welcome Center"],
  ["Homecoming Booth", "Quad"],
  ["Wolverine Welcome", "Quad"],
  ["Counselor Breakfast", "Grande Ballroom"],
] as const;

function semesterForToday(today: string) {
  const [y, m] = today.split("-").map(Number);
  if (m >= 8) return { name: `Fall ${y}`, startsOn: `${y}-08-24`, endsOn: `${y}-12-11` };
  if (m <= 4) return { name: `Spring ${y}`, startsOn: `${y}-01-07`, endsOn: `${y}-04-24` };
  return { name: `Summer ${y}`, startsOn: `${y}-05-04`, endsOn: `${y}-08-07` };
}

function holidays(startsOn: string, endsOn: string): Set<string> {
  const set = new Set<string>();
  for (let d = startsOn; d <= endsOn; d = addDays(d, 1)) {
    const [, m, day] = d.split("-").map(Number);
    const wd = weekdayOf(d);
    if (m === 9 && wd === 1 && day <= 7) set.add(d); // Labor Day
    if (m === 10 && (wd === 4 || wd === 5) && day >= 15 && day <= 21) set.add(d); // Fall break
    if (m === 11 && wd >= 3 && wd <= 5 && day >= 24 && day <= 30) set.add(d); // Thanksgiving
  }
  return set;
}


export async function seedDemo() {
  const db = await getDb();
  const now = new Date();
  const today = todayKey();
  const sem = semesterForToday(today);

  // Wipe (demo database only — caller guarantees this)
  await db.delete(schema.signups);
  await db.delete(schema.events);
  await db.delete(schema.loginTokens);
  await db.delete(schema.emailLog);
  await db.update(schema.users).set({ teamId: null });
  await db.delete(schema.teams);
  await db.delete(schema.users);
  await db.delete(schema.semesters);
  await db.delete(schema.settings);

  await db.insert(schema.semesters).values({ ...sem, isCurrent: true, reqTours: 7, reqEvents: 6, reqHsVisits: 4, reqHsVisitsAc: 2 });
  await db.insert(schema.settings).values([
    { key: "outlook_ics_url", value: "" },
    { key: "auto_shift_reminders", value: "true" },
    { key: "auto_weekly_nudges", value: "false" },
  ]);

  // ---------- People ----------
  const token = () => crypto.randomBytes(18).toString("base64url");
  const usedNames = new Set<string>();
  const makeName = (fixed?: string) => {
    if (fixed) {
      usedNames.add(fixed);
      return fixed;
    }
    let n = "";
    do n = `${pick(FIRST)} ${pick(LAST)}`;
    while (usedNames.has(n));
    usedNames.add(n);
    return n;
  };
  const emailFor = (name: string) => name.toLowerCase().replace(/[^a-z ]/g, "").replace(" ", ".") + "@example.com";

  const admins = [
    { name: "Program Admin", email: DEMO_EMAILS.admin },
    { name: makeName("Rachel Sorensen"), email: "" },
    { name: makeName("Dallin Pratt"), email: "" },
    { name: makeName("Grace Tanner"), email: "" },
  ].map((a) => ({ ...a, email: a.email || emailFor(a.name), role: "admin" as const, calendarToken: token(), onboardedAt: now }));

  const managerNames = [makeName("Ashley Jensen"), makeName(), makeName(), makeName(), makeName(), makeName()];
  const managers = managerNames.map((name) => ({ name, email: emailFor(name), role: "manager" as const, calendarToken: token(), onboardedAt: now }));

  const ambassadorNames = [makeName("Jordan Lee"), ...Array.from({ length: 39 }, () => makeName())];
  const ambassadors = ambassadorNames.map((name, i) => ({
    name,
    email: emailFor(name),
    role: "ambassador" as const,
    calendarToken: token(),
    // a few people have never logged in yet
    onboardedAt: i > 0 && i % 9 === 0 ? null : now,
    lastLoginAt: i > 0 && i % 9 === 0 ? null : now,
  }));

  const insertedAdmins = await db.insert(schema.users).values(admins).returning();
  const insertedManagers = await db.insert(schema.users).values(managers).returning();
  const insertedAmbs = await db.insert(schema.users).values(ambassadors).returning();
  void insertedAdmins;

  const teamNames = ["Team Timp", "Team Cascade", "Team Nebo", "Team Lone Peak", "Team Provo Peak", "Team Box Elder"];
  const insertedTeams = await db
    .insert(schema.teams)
    .values(teamNames.map((name, i) => ({ name, managerId: insertedManagers[i].id })))
    .returning();

  const { eq } = await import("drizzle-orm");
  for (let i = 0; i < insertedManagers.length; i++) {
    await db.update(schema.users).set({ teamId: insertedTeams[i].id }).where(eq(schema.users.id, insertedManagers[i].id));
  }
  for (let i = 0; i < insertedAmbs.length; i++) {
    await db.update(schema.users).set({ teamId: insertedTeams[i % insertedTeams.length].id }).where(eq(schema.users.id, insertedAmbs[i].id));
  }

  // ---------- Events ----------
  type NewEvent = typeof schema.events.$inferInsert;
  const evs: NewEvent[] = [];
  const off = holidays(sem.startsOn, sem.endsOn);
  let hsIndex = 0;
  let eventIndex = 0;
  const mk = (date: string, start: string, end: string, e: Partial<NewEvent> & Pick<NewEvent, "title" | "type">): NewEvent => ({
    startsAt: utahToDate(date, start),
    endsAt: utahToDate(date, end),
    source: "app",
    ...e,
  });

  for (let d = sem.startsOn; d <= sem.endsOn; d = addDays(d, 1)) {
    const wd = weekdayOf(d);
    if (off.has(d)) {
      if (wd === 4 && d.slice(5, 7) === "10") {
        evs.push({
          title: "Fall break — no tours",
          type: "calendar",
          startsAt: utahToDate(d),
          endsAt: utahToDate(addDays(d, 2)),
          allDay: true,
          source: "outlook",
          externalId: `demo-fallbreak-${d}`,
        });
      }
      continue;
    }
    if (wd >= 1 && wd <= 5) {
      evs.push(mk(d, "10:00", "11:00", { title: "Campus tour", type: "tour", spots: 2, location: "Welcome Center" }));
      evs.push(mk(d, "14:00", "15:00", { title: "Campus tour", type: "tour", spots: 2, location: "Welcome Center" }));
    }
    if (wd >= 1 && wd <= 4) {
      const school = SCHOOLS[hsIndex % SCHOOLS.length];
      evs.push(
        mk(d, "08:30", "11:00", {
          title: school,
          type: "hs_visit",
          spots: 3,
          withAc: hsIndex % 2 === 0,
          location: school,
          notes: "Meet at the Welcome Center at 8:00 to carpool.",
        }),
      );
      hsIndex++;
    }
    if (wd === 3) {
      evs.push(
        mk(d, "17:00", "18:00", {
          title: "Ambassador meeting",
          type: "calendar",
          location: "SC 206",
          source: "outlook",
          externalId: `demo-meeting-${d}`,
        }),
      );
    }
    // ~2-3 events per week (Tue evening, Sat, some Thu)
    if (wd === 2 || wd === 6 || (wd === 4 && rand() < 0.5)) {
      const [title, location] = EVENT_NAMES[eventIndex % EVENT_NAMES.length];
      const start = wd === 6 ? "09:00" : "18:00";
      const end = wd === 6 ? "12:00" : "20:00";
      evs.push(mk(d, start, end, { title, type: "event", spots: 4 + Math.floor(rand() * 5), location }));
      eventIndex++;
    }
  }
  evs.push(
    mk(addDays(sem.startsOn, 2), "16:00", "18:00", {
      title: "Tour training",
      type: "calendar",
      location: "SC 206",
      source: "outlook",
      externalId: "demo-training",
    }),
  );

  const insertedEvents: (typeof schema.events.$inferSelect)[] = [];
  for (let i = 0; i < evs.length; i += 200) {
    insertedEvents.push(...(await db.insert(schema.events).values(evs.slice(i, i + 200)).returning()));
  }

  // ---------- Sign-ups ----------
  const filled = new Map<string, number>();
  const signups: (typeof schema.signups.$inferInsert)[] = [];
  const startMs = new Date(sem.startsOn + "T00:00:00Z").getTime();
  const endMs = new Date(sem.endsOn + "T23:59:59Z").getTime();
  const elapsed = Math.min(1, Math.max(0, (now.getTime() - startMs) / (endMs - startMs)));
  const open = (e: (typeof insertedEvents)[number]) => e.spots != null && (filled.get(e.id) ?? 0) < e.spots;

  const ofType = (type: string, past: boolean, ac?: boolean) =>
    insertedEvents.filter(
      (e) =>
        e.type === type &&
        (past ? e.endsAt <= now : e.startsAt > now) &&
        (ac === undefined || e.withAc === ac),
    );

  const take = (userId: string, pool: typeof insertedEvents, n: number, mine: Set<string>) => {
    let added = 0;
    for (const e of shuffle(pool)) {
      if (added >= n) break;
      if (!open(e) || mine.has(e.id)) continue;
      mine.add(e.id);
      filled.set(e.id, (filled.get(e.id) ?? 0) + 1);
      signups.push({ eventId: e.id, userId, status: rand() < 0.03 ? "no_show" : "going" });
      added++;
    }
  };

  const reqs = { tour: 7, event: 6, hs_visit: 4 };
  insertedAmbs.forEach((amb, i) => {
    const f = i === 0 ? 0.85 : i % 13 === 5 ? 0 : 0.15 + rand() * 1.05;
    const mine = new Set<string>();
    for (const type of ["tour", "event", "hs_visit"] as const) {
      const total = Math.min(reqs[type] + (rand() < 0.15 ? 1 : 0), Math.round(reqs[type] * Math.min(1.1, f) * (0.85 + rand() * 0.3)));
      const pastN = Math.min(total, Math.round(reqs[type] * elapsed * f * (0.9 + rand() * 0.4)));
      const futureN = total - pastN;
      if (type === "hs_visit") {
        const acPast = Math.min(pastN, Math.round(rand() * 1.4 * f));
        take(amb.id, ofType(type, true, true), acPast, mine);
        take(amb.id, ofType(type, true, false), pastN - acPast, mine);
        const acFuture = Math.min(futureN, Math.max(0, Math.round(2 * f) - acPast));
        take(amb.id, ofType(type, false, true), acFuture, mine);
        take(amb.id, ofType(type, false, false), futureN - acFuture, mine);
      } else {
        take(amb.id, ofType(type, true), pastN, mine);
        // Upcoming sign-ups cluster in the next few weeks, like real life
        const soon = ofType(type, false).filter((e) => e.startsAt.getTime() < now.getTime() + 1000 * 60 * 60 * 24 * 35);
        take(amb.id, soon, futureN, mine);
      }
    }
  });
  // Managers pick up a few shifts too
  insertedManagers.forEach((m) => take(m.id, ofType("tour", false), 2, new Set()));

  for (let i = 0; i < signups.length; i += 300) {
    await db.insert(schema.signups).values(signups.slice(i, i + 300));
  }

  return {
    semester: sem.name,
    people: admins.length + managers.length + ambassadors.length,
    events: insertedEvents.length,
    signups: signups.length,
  };
}
