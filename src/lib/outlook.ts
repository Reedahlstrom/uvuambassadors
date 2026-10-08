import "server-only";
import { and, eq, gte, inArray, isNull, lt, notInArray, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { addDays, utahToDate } from "./dates";
import { getSemester, getSetting, setSetting } from "./data";

/**
 * Pulls the program's Outlook calendar (published as an .ics link) into the app.
 * Outlook items show on the calendar as info-only ("Outlook calendar" layer).
 * Admins can later give one spots to make it sign-up-able — sync keeps those edits.
 *
 * Outlook → Settings → Calendar → Shared calendars → Publish a calendar → copy the ICS link.
 */

type Param = string | { val: string } | undefined;
const text = (v: Param) => (typeof v === "string" ? v : (v?.val ?? "")).trim();

export async function syncOutlook(): Promise<{ ok: boolean; message: string }> {
  const url = (await getSetting("outlook_ics_url")).trim();
  if (!url) return { ok: false, message: "No Outlook link saved yet." };

  const ical = (await import("node-ical")).default;
  let data: Awaited<ReturnType<typeof ical.async.parseICS>>;
  try {
    const res = await fetch(url.replace(/^webcal:\/\//, "https://"), { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await ical.async.parseICS(await res.text());
  } catch (e) {
    const message = `Couldn't read the Outlook link (${e instanceof Error ? e.message : "error"}).`;
    await setSetting("outlook_last_sync", JSON.stringify({ at: new Date().toISOString(), ok: false, message }));
    return { ok: false, message };
  }

  const semester = await getSemester();
  const from = utahToDate(addDays(semester.startsOn, -14));
  const to = utahToDate(addDays(semester.endsOn, 60));

  type Row = typeof schema.events.$inferInsert;
  const byKey = new Map<string, Row>();
  let skipped = 0;
  for (const item of Object.values(data)) {
    if (!item || item.type !== "VEVENT") continue;
    // Skip cancelled items
    if ((item as { status?: string }).status === "CANCELLED") continue;
    try {
      const instances = ical.expandRecurringEvent(item, { from, to });
      for (const inst of instances) {
        const ev = inst.event;
        let start = new Date(inst.start);
        let end = inst.end ? new Date(inst.end) : new Date(start.getTime() + 60 * 60 * 1000);
        if (inst.isFullDay) {
          // node-ical gives all-day dates as midnight in the *server's* time zone; pin them to Utah days
          const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const s = ymd(start);
          const e = inst.end ? ymd(end) : addDays(s, 1);
          start = utahToDate(s);
          end = utahToDate(e > s ? e : addDays(s, 1));
        }
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
        // Stable key: one-off items by UID; repeating items by UID + the occurrence's ORIGINAL start,
        // so moving a meeting in Outlook updates the same row instead of creating a new one.
        const original = (ev as { recurrenceid?: Date }).recurrenceid ?? inst.start;
        const key = inst.isRecurring ? `${item.uid}|${new Date(original).toISOString()}` : item.uid;
        byKey.set(key, {
          title: text(inst.summary as Param) || "Untitled",
          type: "calendar",
          startsAt: start,
          endsAt: end,
          allDay: inst.isFullDay,
          location: text(ev.location as Param) || null,
          notes: text((ev as { description?: Param }).description).slice(0, 2000) || null,
          source: "outlook",
          externalId: key,
        });
      }
    } catch (e) {
      skipped++;
      console.error("Outlook item skipped", item.uid, e);
    }
  }
  const rows = [...byKey.values()];

  const db = await getDb();
  const seen = rows.map((r) => r.externalId!);
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    await db
      .insert(schema.events)
      .values(chunk)
      .onConflictDoUpdate({
        target: schema.events.externalId,
        // Only refresh what Outlook owns; keep admin edits like type/spots/AC.
        set: {
          title: sqlExcluded("title"),
          startsAt: sqlExcluded("starts_at"),
          endsAt: sqlExcluded("ends_at"),
          allDay: sqlExcluded("all_day"),
          location: sqlExcluded("location"),
          notes: sqlExcluded("notes"),
          updatedAt: new Date(),
        },
      });
  }

  // Remove Outlook items that disappeared from Outlook — only plain info items nobody signed up for.
  // Anything an admin turned into a sign-up (type changed or spots added) is never deleted.
  // An empty feed is treated as a glitch, not "delete everything".
  const gone =
    rows.length === 0
      ? []
      : await db
          .select({ id: schema.events.id })
          .from(schema.events)
          .where(
            and(
              eq(schema.events.source, "outlook"),
              eq(schema.events.type, "calendar"),
              isNull(schema.events.spots),
              gte(schema.events.startsAt, from),
              lt(schema.events.startsAt, to),
              notInArray(schema.events.externalId, seen),
            ),
          );
  let removed = 0;
  if (gone.length) {
    const ids = gone.map((g) => g.id);
    const withPeople = await db.select({ id: schema.signups.eventId }).from(schema.signups).where(inArray(schema.signups.eventId, ids));
    const keep = new Set(withPeople.map((w) => w.id));
    const del = ids.filter((id) => !keep.has(id));
    if (del.length) await db.delete(schema.events).where(inArray(schema.events.id, del));
    removed = del.length;
  }

  const message = `Synced ${rows.length} Outlook items${removed ? `, removed ${removed}` : ""}${skipped ? `, skipped ${skipped} unreadable` : ""}.`;
  await setSetting("outlook_last_sync", JSON.stringify({ at: new Date().toISOString(), ok: true, message }));
  return { ok: true, message };
}

function sqlExcluded(col: string) {
  return sql.raw(`excluded.${col}`);
}
