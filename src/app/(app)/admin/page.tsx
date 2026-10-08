import { requireRole } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, eq, gte, isNotNull, lt } from "drizzle-orm";
import { PeopleTable } from "@/components/people-table";
import { StatTiles } from "@/components/stat-tiles";
import { Dot } from "@/components/ui";
import { Download } from "lucide-react";
import { TYPE_META } from "@/lib/config";
import { getProgress, getSemester, getTeams, reqsOf } from "@/lib/data";
import { getDb, schema } from "@/lib/db";
import { dateShort, timeShort } from "@/lib/dates";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverview() {
  const user = await requireRole("admin");
  const semester = await getSemester();
  const reqs = reqsOf(semester);
  const [people, teams] = await Promise.all([getProgress(), getTeams()]);
  const db = await getDb();

  // Upcoming items in the next 14 days that still need people
  const now = new Date();
  const soon = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);
  const upcoming = await db
    .select({ event: schema.events, filled: count(schema.signups.id) })
    .from(schema.events)
    .leftJoin(schema.signups, eq(schema.signups.eventId, schema.events.id))
    .where(and(gte(schema.events.startsAt, now), lt(schema.events.startsAt, soon), isNotNull(schema.events.spots)))
    .groupBy(schema.events.id)
    .orderBy(asc(schema.events.startsAt));
  const needsPeople = upcoming.filter((u) => u.filled < (u.event.spots ?? 0));
  const openSpots = needsPeople.reduce((sum, u) => sum + (u.event.spots! - u.filled), 0);

  return (
    <div>
      <StatTiles people={people} extra={[{ label: "Open spots, next 2 weeks", value: openSpots }]} />

      {needsPeople.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-semibold text-ink">Needs people</h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {needsPeople.slice(0, 6).map(({ event: e, filled }) => (
              <Link
                key={e.id}
                href={`/admin/events/${e.id}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-soft hover:border-brand/40"
              >
                <Dot color={TYPE_META[e.type].color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-ink">{e.title}</p>
                  <p className="text-[13px] text-muted">
                    {dateShort(e.startsAt)} · {timeShort(e.startsAt)}
                  </p>
                </div>
                <span className="rounded-full bg-warn-soft px-2.5 py-1 text-[13px] font-medium text-warn tabular-nums">
                  {filled}/{e.spots}
                </span>
              </Link>
            ))}
          </div>
          {needsPeople.length > 6 && (
            <Link href="/admin/events" className="mt-2 inline-block text-sm font-medium text-brand hover:underline">
              {needsPeople.length - 6} more
            </Link>
          )}
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-ink">Ambassadors</h2>
          <a href="/api/export/progress" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            <Download size={15} /> Export CSV
          </a>
        </div>
        <PeopleTable people={people} reqs={reqs} showTeam teams={teams} canRemind senderName={user.name} />
      </section>
    </div>
  );
}
