import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { ShiftRow } from "../../my/shift-row";
import { ProgressCard } from "@/components/progress-card";
import { Avatar, Card, Empty } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getSemester, reqsOf, semesterRange } from "@/lib/data";
import { getDb, schema } from "@/lib/db";
import { semesterElapsed, statusOf, tally } from "@/lib/progress";

export const metadata: Metadata = { title: "Person" };

const ROLE_LABEL = { ambassador: "Ambassador", manager: "Manager", admin: "Admin" } as const;

/** One person's progress and shifts. Admins see anyone; managers see people on their own team. */
export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireRole("manager", "admin");
  const db = await getDb();

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db
    .select({ user: schema.users, team: schema.teams })
    .from(schema.users)
    .leftJoin(schema.teams, eq(schema.teams.id, schema.users.teamId))
    .where(eq(schema.users.id, id));
  if (!row) notFound();
  const { user: person, team } = row;
  if (viewer.role !== "admin" && team?.managerId !== viewer.id) notFound();

  const semester = await getSemester();
  const reqs = reqsOf(semester);
  const { from, to } = semesterRange(semester);
  const rows = await db
    .select({ event: schema.events, status: schema.signups.status })
    .from(schema.signups)
    .innerJoin(schema.events, eq(schema.events.id, schema.signups.eventId))
    .where(and(eq(schema.signups.userId, person.id), gte(schema.events.startsAt, from), lt(schema.events.startsAt, to)))
    .orderBy(asc(schema.events.startsAt));

  const now = new Date();
  const upcoming = rows.filter((r) => r.event.endsAt > now);
  const done = rows.filter((r) => r.event.endsAt <= now).reverse();
  const t = tally(rows.map((r) => ({ type: r.event.type, withAc: r.event.withAc, endsAt: r.event.endsAt, status: r.status })));
  const status = statusOf(t, reqs, semesterElapsed(semester.startsOn, semester.endsOn));

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
  const back = viewer.role === "admin" ? { href: "/admin", label: "Admin" } : { href: "/team", label: "My team" };

  return (
    <div>
      <Link href={back.href} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ChevronLeft size={16} /> {back.label}
      </Link>
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={person.name} size={56} />
        <div className="min-w-0">
          <h1 className="font-display text-[34px] leading-none text-ink sm:text-[40px]">{person.name}</h1>
          <p className="mt-1.5 truncate text-[15px] text-muted">
            {ROLE_LABEL[person.role]}
            {team && ` · ${team.name}`}
            {viewer.role === "admin" && ` · ${person.email}`}
            {!person.lastLoginAt && " · Hasn't signed in yet"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="order-2 space-y-8 lg:order-1">
          <section>
            <h2 className="mb-3 font-semibold text-ink">Coming up</h2>
            {upcoming.length ? (
              <Card className="divide-y divide-line overflow-hidden">
                {upcoming.map((r) => (
                  <ShiftRow key={r.event.id} shift={toRow(r)} />
                ))}
              </Card>
            ) : (
              <Empty>Nothing coming up.</Empty>
            )}
          </section>
          <section>
            <h2 className="mb-3 font-semibold text-ink">Done this semester</h2>
            {done.length ? (
              <Card className="divide-y divide-line overflow-hidden">
                {done.map((r) => (
                  <ShiftRow key={r.event.id} shift={toRow(r)} />
                ))}
              </Card>
            ) : (
              <Empty>Nothing yet.</Empty>
            )}
          </section>
        </div>
        <div className="order-1 lg:order-2 lg:sticky lg:top-24 lg:self-start">
          {person.role === "ambassador" ? (
            <ProgressCard title={semester.name} tally={t} reqs={reqs} status={status} />
          ) : (
            <Card className="p-5 text-[15px] text-muted">{ROLE_LABEL[person.role]}s don&apos;t have requirements.</Card>
          )}
        </div>
      </div>
    </div>
  );
}
