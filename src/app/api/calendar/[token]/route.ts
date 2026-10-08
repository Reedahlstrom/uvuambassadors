import { and, asc, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { buildIcs } from "@/lib/ics";
import { baseUrl } from "@/lib/url";

// Personal calendar feed: /api/calendar/<token>.ics — subscribe from Outlook / Google / Apple.
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token: raw } = await ctx.params;
  const token = raw.replace(/\.ics$/, "");
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.calendarToken, token));
  if (!user || !user.active) return new Response("Not found", { status: 404 });

  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60);
  const rows = await db
    .select({ event: schema.events })
    .from(schema.signups)
    .innerJoin(schema.events, eq(schema.events.id, schema.signups.eventId))
    .where(and(eq(schema.signups.userId, user.id), gte(schema.events.startsAt, since)))
    .orderBy(asc(schema.events.startsAt));

  const base = await baseUrl();
  const ics = buildIcs(
    "UVU Ambassador shifts",
    rows.map(({ event: e }) => ({
      uid: `${e.id}@uvuambassadors`,
      title: e.title,
      start: e.startsAt,
      end: e.endsAt,
      allDay: e.allDay,
      location: e.location,
      description: e.notes,
      url: `${base}/my`,
    })),
  );
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="uvu-ambassador-shifts.ics"',
      "Cache-Control": "no-store",
    },
  });
}
