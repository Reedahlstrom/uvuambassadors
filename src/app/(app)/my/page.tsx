import type { Metadata } from "next";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { CalendarSubscribe } from "@/components/calendar-subscribe";
import { ProgressCard } from "@/components/progress-card";
import { Card, ButtonLink, Empty, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { feedLinks } from "@/lib/calendar-links";
import { getSemester, reqsOf, semesterRange } from "@/lib/data";
import { getDb, schema } from "@/lib/db";
import { semesterElapsed, statusOf, tally } from "@/lib/progress";
import { baseUrl } from "@/lib/url";
import { ShiftRow } from "./shift-row";

export const metadata: Metadata = { title: "My shifts" };

export default async function MyShiftsPage() {
  const user = await requireUser();
  const semester = await getSemester();
  const reqs = reqsOf(semester);
  const { from, to } = semesterRange(semester);
  const db = await getDb();

  const rows = await db
    .select({ event: schema.events, status: schema.signups.status })
    .from(schema.signups)
    .innerJoin(schema.events, eq(schema.events.id, schema.signups.eventId))
    .where(and(eq(schema.signups.userId, user.id), gte(schema.events.startsAt, from), lt(schema.events.startsAt, to)))
    .orderBy(asc(schema.events.startsAt));

  const now = new Date();
  const upcoming = rows.filter((r) => r.event.endsAt > now);
  const done = rows.filter((r) => r.event.endsAt <= now).reverse();
  const t = tally(rows.map((r) => ({ type: r.event.type, withAc: r.event.withAc, endsAt: r.event.endsAt, status: r.status })));
  const status = statusOf(t, reqs, semesterElapsed(semester.startsOn, semester.endsOn));
  const links = feedLinks(await baseUrl(), user.calendarToken);

  const toRow = (r: (typeof rows)[number]) => ({
    id: r.event.id,
    title: r.event.title,
    type: r.event.type,
    startsAt: r.event.startsAt.toISOString(),
    endsAt: r.event.endsAt.toISOString(),
    allDay: r.event.allDay,
    location: r.event.location,
    withAc: r.event.withAc,
    noShow: r.status === "no_show",
  });

  return (
    <div>
      <PageTitle>My shifts</PageTitle>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 font-semibold text-ink">Coming up</h2>
            {upcoming.length ? (
              <Card className="divide-y divide-line overflow-hidden">
                {upcoming.map((r) => (
                  <ShiftRow key={r.event.id} shift={toRow(r)} canDrop />
                ))}
              </Card>
            ) : (
              <Empty>
                <p className="mb-4">You&apos;re not signed up for anything yet.</p>
                <ButtonLink href="/calendar">Find something</ButtonLink>
              </Empty>
            )}
          </section>
          {done.length > 0 && (
            <section>
              <h2 className="mb-3 font-semibold text-ink">Done this semester</h2>
              <Card className="divide-y divide-line overflow-hidden">
                {done.map((r) => (
                  <ShiftRow key={r.event.id} shift={toRow(r)} />
                ))}
              </Card>
            </section>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {user.role === "ambassador" && <ProgressCard title={semester.name} tally={t} reqs={reqs} status={status} />}
          <Card className="p-5">
            <p className="font-semibold text-ink">Add to my calendar</p>
            <p className="mt-1 mb-4 text-sm text-muted">Your shifts sync to your phone automatically.</p>
            <CalendarSubscribe links={links} />
          </Card>
        </div>
      </div>
    </div>
  );
}
