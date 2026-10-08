import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { buildIcs } from "@/lib/ics";
import { baseUrl } from "@/lib/url";

// One event as a .ics file: "Add to calendar → Apple" (opens Calendar on Mac / iPhone)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const [e] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  if (!e) return new Response("Not found", { status: 404 });
  const base = await baseUrl();
  const ics = buildIcs("UVU Ambassador events", [
    {
      // Same UID as the subscription feed, so calendars treat them as one event
      uid: `${e.id}@uvuambassadors`,
      title: e.title,
      start: e.startsAt,
      end: e.endsAt,
      allDay: e.allDay,
      location: e.location,
      description: e.notes,
      url: `${base}/my`,
    },
  ]);
  const file = e.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "event";
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
