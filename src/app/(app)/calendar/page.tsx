import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { CalendarApp } from "@/components/calendar/calendar-app";
import { requireUser } from "@/lib/auth";
import { getCalendarEvents, getSemester, reqsOf } from "@/lib/data";
import { getDb, schema } from "@/lib/db";
import { todayKey } from "@/lib/dates";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const user = await requireUser();
  const semester = await getSemester();
  const events = await getCalendarEvents(semester);

  let everyone: { id: string; name: string }[] = [];
  if (user.role === "admin") {
    const db = await getDb();
    everyone = await db
      .select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.active, true))
      .orderBy(asc(schema.users.name));
  }

  return (
    <CalendarApp
      events={events}
      me={user.id}
      role={user.role}
      semester={{ name: semester.name, startsOn: semester.startsOn, endsOn: semester.endsOn }}
      reqs={reqsOf(semester)}
      everyone={everyone}
      today={todayKey()}
      initialShow={show === "open" || show === "mine" ? show : undefined}
    />
  );
}
