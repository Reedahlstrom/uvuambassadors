"use server";

import crypto from "node:crypto";
import { and, eq, gte, like, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getSemester, setSetting } from "@/lib/data";
import { getDb, schema } from "@/lib/db";
import { addDays, dateLong, dateToUtah, timeRange, utahToDate } from "@/lib/dates";
import { APP_URL, PLACEHOLDER_EMAIL_DOMAIN } from "@/lib/config";
import { sendEmails } from "@/lib/email";
import type { ActionResult } from "./signups";
import { syncOutlook } from "@/lib/outlook";

export type FormState = { error?: string; ok?: string };

const refresh = () => revalidatePath("/", "layout");

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const EventInput = z.object({
  id: z.string().optional(),
  type: z.enum(["tour", "event", "hs_visit", "calendar"]),
  title: z.string().trim().min(1, "Add a title"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  start: z.string().optional(),
  end: z.string().optional(),
  allDay: z.string().optional(),
  location: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  spots: z.string().optional(),
  withAc: z.string().optional(),
  repeatUntil: z.string().optional(),
});

export async function saveEvent(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = EventInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const allDay = v.allDay === "on";
  const time = /^\d{2}:\d{2}$/;
  if (!allDay && (!time.test(v.start ?? "") || !time.test(v.end ?? ""))) return { error: "Pick a start and end time." };
  if (!allDay && v.end! <= v.start!) return { error: "End time must be after start time." };
  const when = (d: string) =>
    allDay
      ? { allDay, startsAt: utahToDate(d), endsAt: utahToDate(addDays(d, 1)) }
      : { allDay, startsAt: utahToDate(d, v.start), endsAt: utahToDate(d, v.end) };
  const spots = v.spots?.trim() ? Number(v.spots) : null;
  if (spots != null && (!Number.isInteger(spots) || spots < 1 || spots > 500)) return { error: "Spots must be a whole number." };

  const db = await getDb();
  const base = {
    type: v.type,
    title: v.title,
    location: v.location || null,
    notes: v.notes || null,
    spots: v.type === "calendar" ? spots : (spots ?? 1),
    withAc: v.type === "hs_visit" && v.withAc === "on",
    updatedAt: new Date(),
  };

  if (v.id) {
    await db
      .update(schema.events)
      .set({ ...base, ...when(v.date) })
      .where(eq(schema.events.id, v.id));
  } else {
    const dates = [v.date];
    if (v.repeatUntil && v.repeatUntil > v.date) {
      for (let d = addDays(v.date, 7); d <= v.repeatUntil && dates.length < 60; d = addDays(d, 7)) dates.push(d);
    }
    const seriesId = dates.length > 1 ? crypto.randomUUID() : null;
    await db.insert(schema.events).values(
      dates.map((d) => ({ ...base, seriesId, ...when(d) })),
    );
  }
  refresh();
  redirect("/admin/events");
}

/** Emails everyone signed up for an upcoming event (date changed / cancelled). */
async function tellSignedUp(
  event: typeof schema.events.$inferSelect,
  sentById: string,
  subject: string,
  heading: string,
  lines: string[],
) {
  if (event.startsAt <= new Date()) return 0;
  const db = await getDb();
  const people = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.signups)
    .innerJoin(schema.users, eq(schema.users.id, schema.signups.userId))
    .where(eq(schema.signups.eventId, event.id));
  const to = people.filter((p) => !p.email.endsWith(PLACEHOLDER_EMAIL_DOMAIN));
  return sendEmails(
    to.map((p) => ({
      to: p.email,
      toUserId: p.id,
      sentById,
      kind: "shift" as const,
      subject,
      heading,
      lines,
      button: { label: "My shifts", url: `${APP_URL}/my` },
    })),
  );
}

/** Drag and drop on the calendar: same time of day, new date. Tells everyone signed up. */
export async function moveEvent(id: string, day: string): Promise<ActionResult> {
  const admin = await requireRole("admin");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: "Pick a day." };
  const db = await getDb();
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  if (!event) return { ok: false, error: "This was removed." };
  if (event.source === "outlook") return { ok: false, error: "This comes from Outlook. Change it there." };

  const from = dateToUtah(event.startsAt);
  if (from.date === day) return { ok: true, message: "No change" };
  let startsAt: Date;
  let endsAt: Date;
  if (event.allDay) {
    const days = Math.max(1, Math.round((event.endsAt.getTime() - event.startsAt.getTime()) / 86_400_000));
    startsAt = utahToDate(day);
    endsAt = utahToDate(addDays(day, days));
  } else {
    const to = dateToUtah(event.endsAt);
    const span = Math.round((utahToDate(to.date).getTime() - utahToDate(from.date).getTime()) / 86_400_000);
    startsAt = utahToDate(day, from.time);
    endsAt = utahToDate(addDays(day, span), to.time);
  }
  if (endsAt <= startsAt) return { ok: false, error: "That time doesn't exist on that day. Edit it instead." };
  const wasUpcoming = event.startsAt > new Date();
  if (wasUpcoming && startsAt <= new Date()) return { ok: false, error: "Pick a day that hasn't happened yet." };
  await db.update(schema.events).set({ startsAt, endsAt, updatedAt: new Date() }).where(eq(schema.events.id, id));

  const when = `${dateLong(startsAt)}, ${timeRange(startsAt, endsAt, event.allDay)}`;
  const told = await tellSignedUp(
    { ...event, startsAt, endsAt },
    admin.id,
    `New date: ${event.title}`,
    "The date changed",
    [`${event.title} is now ${when}.`, "You're still signed up. If you can't make it, drop it in My shifts."],
  );
  refresh();
  return { ok: true, message: told ? `Moved · emailed ${told} signed up` : "Moved" };
}

export async function deleteEvent(id: string, wholeSeries = false) {
  const admin = await requireRole("admin");
  const db = await getDb();
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  if (!event) redirect("/admin/events");
  const doomed =
    wholeSeries && event.seriesId
      ? await db.select().from(schema.events).where(and(eq(schema.events.seriesId, event.seriesId), gte(schema.events.startsAt, event.startsAt)))
      : [event];
  for (const e of doomed) {
    await tellSignedUp(e, admin.id, `Cancelled: ${e.title}`, "This was cancelled", [
      `${e.title} on ${dateLong(e.startsAt)}, ${timeRange(e.startsAt, e.endsAt, e.allDay)} was cancelled.`,
      "It's off your shifts. Nothing else you need to do.",
    ]);
  }
  if (wholeSeries && event.seriesId) {
    // Delete this one and every later one in the series
    await db
      .delete(schema.events)
      .where(and(eq(schema.events.seriesId, event.seriesId), gte(schema.events.startsAt, event.startsAt)));
  } else {
    await db.delete(schema.events).where(eq(schema.events.id, id));
  }
  refresh();
  redirect("/admin/events");
}

const TYPE_ALIASES: Record<string, "tour" | "event" | "hs_visit" | "calendar"> = {
  tour: "tour",
  tours: "tour",
  event: "event",
  events: "event",
  hs: "hs_visit",
  hs_visit: "hs_visit",
  "hs visit": "hs_visit",
  "high school": "hs_visit",
  "high school visit": "hs_visit",
  calendar: "calendar",
  meeting: "calendar",
  info: "calendar",
};

function to24h(t: string): string | null {
  const m = t.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ?? "00";
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${min}`;
}

function toIsoDate(d: string): string | null {
  const s = d.trim();
  let iso: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) iso = `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  if (!iso) return null;
  // Reject dates that don't exist (13/45/2026 would otherwise roll over)
  const [y, mo, da] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, da));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === da ? iso : null;
}

export type ImportResult = { ok: boolean; created: number; errors: string[] };

/** CSV columns: title, type, date, start, end, location, spots, with_ac, notes */
export async function importEvents(rows: Record<string, string>[]): Promise<ImportResult> {
  await requireRole("admin");
  const errors: string[] = [];
  const values: (typeof schema.events.$inferInsert)[] = [];
  rows.slice(0, 2000).forEach((raw, i) => {
    const r = Object.fromEntries(Object.entries(raw).map(([k, val]) => [k.trim().toLowerCase().replace(/\s+/g, "_"), String(val ?? "").trim()]));
    const line = i + 2;
    if (!r.title && !r.date) return;
    const type = TYPE_ALIASES[(r.type || "").toLowerCase()];
    const date = toIsoDate(r.date || "");
    const start = to24h(r.start || "");
    const end = to24h(r.end || "");
    if (!r.title) return errors.push(`Row ${line}: missing title`);
    if (!type) return errors.push(`Row ${line}: type should be tour, event, hs visit or calendar`);
    if (!date) return errors.push(`Row ${line}: date should look like 2026-10-14 or 10/14/2026`);
    if (!start || !end) return errors.push(`Row ${line}: times should look like 10:00 or 2:30 PM`);
    if (end <= start) return errors.push(`Row ${line}: end time must be after start time`);
    const spots = r.spots ? Number(r.spots) : type === "calendar" ? null : 1;
    if (spots != null && (!Number.isInteger(spots) || spots < 1 || spots > 500)) {
      return errors.push(`Row ${line}: spots should be a whole number from 1 to 500`);
    }
    values.push({
      title: r.title,
      type,
      startsAt: utahToDate(date, start),
      endsAt: utahToDate(date, end),
      location: r.location || null,
      notes: r.notes || null,
      spots,
      withAc: type === "hs_visit" && /^(y|yes|true|1|x)$/i.test(r.with_ac || ""),
    });
  });
  if (values.length && errors.length === 0) {
    const db = await getDb();
    // All or nothing, so a retry never creates duplicates
    await db.transaction(async (tx) => {
      for (let i = 0; i < values.length; i += 200) await tx.insert(schema.events).values(values.slice(i, i + 200));
    });
    refresh();
  }
  return { ok: errors.length === 0, created: errors.length ? 0 : values.length, errors: errors.slice(0, 20) };
}

// ---------------------------------------------------------------------------
// People & teams
// ---------------------------------------------------------------------------

const PersonInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Add a name"),
  email: z.string().trim().toLowerCase().email("That email doesn't look right"),
  role: z.enum(["ambassador", "manager", "admin"]),
  teamId: z.string().optional(),
  active: z.string().optional(),
});

export async function savePerson(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = PersonInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const db = await getDb();
  const clash = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(v.id ? and(eq(schema.users.email, v.email), ne(schema.users.id, v.id)) : eq(schema.users.email, v.email));
  if (clash.length) return { error: "Someone already has that email." };

  const values = { name: v.name, email: v.email, role: v.role, teamId: v.teamId || null };
  if (v.id) {
    await db
      .update(schema.users)
      .set({ ...values, active: v.active !== "off" })
      .where(eq(schema.users.id, v.id));
  } else {
    await db.insert(schema.users).values({ ...values, calendarToken: crypto.randomBytes(18).toString("base64url") });
  }
  refresh();
  return { ok: v.id ? "Saved" : `Added ${v.name}` };
}

export async function setPersonTeam(userId: string, teamId: string | null): Promise<FormState> {
  await requireRole("admin");
  const db = await getDb();
  await db.update(schema.users).set({ teamId }).where(eq(schema.users.id, userId));
  refresh();
  return { ok: "Saved" };
}

/** CSV columns: name, email, role (ambassador/manager/admin), team */
export async function importPeople(rows: Record<string, string>[]): Promise<ImportResult> {
  await requireRole("admin");
  const db = await getDb();
  const teams = await db.select().from(schema.teams);
  const teamByName = new Map(teams.map((t) => [t.name.toLowerCase(), t.id]));
  const errors: string[] = [];
  let created = 0;

  for (const [i, raw] of rows.slice(0, 1000).entries()) {
    const r = Object.fromEntries(Object.entries(raw).map(([k, val]) => [k.trim().toLowerCase(), String(val ?? "").trim()]));
    const line = i + 2;
    if (!r.name && !r.email) continue;
    const email = (r.email || "").toLowerCase();
    if (!r.name || !email.includes("@")) {
      errors.push(`Row ${line}: needs a name and email`);
      continue;
    }
    const roleCell = (r.role || "").toLowerCase();
    if (roleCell && !["ambassador", "manager", "admin"].includes(roleCell)) {
      errors.push(`Row ${line}: role should be ambassador, manager or admin`);
      continue;
    }
    const role = (roleCell || null) as "ambassador" | "manager" | "admin" | null;
    let teamId: string | null = null;
    if (r.team) {
      teamId = teamByName.get(r.team.toLowerCase()) ?? null;
      if (!teamId) {
        const [t] = await db.insert(schema.teams).values({ name: r.team }).returning();
        teamByName.set(r.team.toLowerCase(), t.id);
        teamId = t.id;
      }
    }
    let existing = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
    if (!existing.length) {
      // People loaded from SignUpGenius have a placeholder email; fill in the real one by name instead of duplicating them
      existing = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(and(sql`lower(${schema.users.name}) = ${r.name.toLowerCase()}`, like(schema.users.email, `%${PLACEHOLDER_EMAIL_DOMAIN}`)));
    }
    if (existing.length) {
      // Only change what the CSV actually fills in — a blank role or team never demotes or un-assigns anyone
      await db
        .update(schema.users)
        .set({ name: r.name, email, ...(role ? { role } : {}), ...(teamId ? { teamId } : {}) })
        .where(eq(schema.users.id, existing[0].id));
    } else {
      await db.insert(schema.users).values({
        name: r.name,
        email,
        role: role ?? "ambassador",
        teamId,
        calendarToken: crypto.randomBytes(18).toString("base64url"),
      });
      created++;
    }
  }
  refresh();
  return { ok: errors.length === 0, created, errors: errors.slice(0, 20) };
}

export async function saveTeam(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("admin");
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const managerId = String(form.get("managerId") ?? "") || null;
  if (!name) return { error: "Add a team name" };
  const db = await getDb();
  let teamId = id;
  if (id) await db.update(schema.teams).set({ name, managerId }).where(eq(schema.teams.id, id));
  else teamId = (await db.insert(schema.teams).values({ name, managerId }).returning())[0].id;
  if (managerId) {
    // The manager belongs to the team they manage, and gets the manager role
    await db
      .update(schema.users)
      .set({ teamId, role: "manager" })
      .where(and(eq(schema.users.id, managerId), ne(schema.users.role, "admin")));
  }
  refresh();
  return { ok: "Saved" };
}

export async function deleteTeam(id: string) {
  await requireRole("admin");
  const db = await getDb();
  await db.update(schema.users).set({ teamId: null }).where(eq(schema.users.teamId, id));
  await db.delete(schema.teams).where(eq(schema.teams.id, id));
  refresh();
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const SemesterInput = z.object({
  name: z.string().trim().min(1, "Add a semester name"),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reqTours: z.coerce.number().int().min(0).max(100),
  reqEvents: z.coerce.number().int().min(0).max(100),
  reqHsVisits: z.coerce.number().int().min(0).max(100),
  reqHsVisitsAc: z.coerce.number().int().min(0).max(100),
});

export async function saveSemester(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = SemesterInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check the semester fields." };
  const v = parsed.data;
  if (v.endsOn <= v.startsOn) return { error: "The semester must end after it starts." };
  if (v.reqHsVisitsAc > v.reqHsVisits) return { error: "AC visits can't be more than total high school visits." };
  const db = await getDb();
  const current = await getSemester();
  if (form.get("asNew") === "on") {
    await db.update(schema.semesters).set({ isCurrent: false });
    await db.insert(schema.semesters).values({ ...v, isCurrent: true });
  } else {
    await db.update(schema.semesters).set(v).where(eq(schema.semesters.id, current.id));
  }
  refresh();
  return { ok: "Saved" };
}

export async function saveIntegrations(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("admin");
  const url = String(form.get("outlookUrl") ?? "").trim();
  if (url && !/^(https?|webcal):\/\//i.test(url)) return { error: "The Outlook link should start with https:// or webcal://" };
  await setSetting("outlook_ics_url", url);
  await setSetting("auto_shift_reminders", form.get("autoShift") === "on" ? "true" : "false");
  await setSetting("auto_weekly_nudges", form.get("autoNudge") === "on" ? "true" : "false");
  refresh();
  return { ok: "Saved" };
}

export async function syncOutlookNow(): Promise<FormState> {
  await requireRole("admin");
  const r = await syncOutlook();
  refresh();
  return r.ok ? { ok: r.message } : { error: r.message };
}
