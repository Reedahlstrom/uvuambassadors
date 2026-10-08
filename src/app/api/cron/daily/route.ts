import { and, eq, gte, lt } from "drizzle-orm";
import { getProgress, getSetting } from "@/lib/data";
import { getDb, schema } from "@/lib/db";
import { addDays, dateLong, timeRange, todayKey, utahToDate, weekdayOf } from "@/lib/dates";
import { sendEmails, type Mail } from "@/lib/email";
import { buildNudges } from "@/lib/nudges";
import { syncOutlook } from "@/lib/outlook";
import { baseUrl } from "@/lib/url";

/**
 * Runs once a day (vercel.json → 8am Utah time):
 *  1. Pull the Outlook calendar
 *  2. Email everyone about tomorrow's shifts
 *  3. Mondays: nudge ambassadors who are behind (if turned on)
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret ? req.headers.get("authorization") !== `Bearer ${secret}` : process.env.NODE_ENV === "production") {
    return new Response("Unauthorized", { status: 401 });
  }

  const out: Record<string, unknown> = {};
  // Each step runs on its own so one failure doesn't stop the others.
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      out[name] = await fn();
    } catch (e) {
      console.error(`cron step ${name} failed`, e);
      out[name] = { error: e instanceof Error ? e.message : String(e) };
    }
  };

  await step("outlook", async () => ((await getSetting("outlook_ics_url")) ? syncOutlook() : "skipped"));

  const today = todayKey();
  await step("shiftReminders", async () => {
    if ((await getSetting("auto_shift_reminders", "true")) !== "true") return "off";
    const db = await getDb();
    const tomorrow = addDays(today, 1);
    const rows = await db
      .select({ event: schema.events, user: schema.users })
      .from(schema.signups)
      .innerJoin(schema.events, eq(schema.events.id, schema.signups.eventId))
      .innerJoin(schema.users, eq(schema.users.id, schema.signups.userId))
      .where(
        and(
          gte(schema.events.startsAt, utahToDate(tomorrow)),
          lt(schema.events.startsAt, utahToDate(addDays(tomorrow, 1))),
          eq(schema.users.active, true),
        ),
      );
    const base = await baseUrl();
    const mails: Mail[] = rows.map(({ event: e, user: u }) => ({
      to: u.email,
      toUserId: u.id,
      kind: "shift",
      subject: `Tomorrow: ${e.title} at ${timeRange(e.startsAt, e.endsAt, e.allDay).split(" – ")[0]}`,
      heading: `See you tomorrow, ${u.name.split(" ")[0]}`,
      lines: [
        `${e.title}`,
        `${dateLong(e.startsAt)} · ${timeRange(e.startsAt, e.endsAt, e.allDay)}`,
        ...(e.location ? [e.location] : []),
        ...(e.notes ? [e.notes] : []),
        "Can't make it? Drop it so someone else can take the spot.",
      ],
      button: { label: "My shifts", url: `${base}/my` },
    }));
    return sendEmails(mails);
  });

  await step("nudges", async () => {
    if (weekdayOf(today) !== 1 || (await getSetting("auto_weekly_nudges", "false")) !== "true") return "off";
    const behind = (await getProgress()).filter((p) => p.status === "behind");
    const { mails } = await buildNudges(
      behind.map((p) => p.id),
      "",
    );
    return sendEmails(mails);
  });

  return Response.json({ ok: true, ...out });
}
