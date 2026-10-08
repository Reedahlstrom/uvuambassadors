import { requireRole } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/lib/db";
import { dateToUtah, todayKey } from "@/lib/dates";
import { EventForm } from "../event-form";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [e] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  if (!e) notFound();
  const s = dateToUtah(e.startsAt);
  const en = dateToUtah(e.endsAt);
  return (
    <EventForm
      today={todayKey()}
      initial={{
        id: e.id,
        type: e.type,
        title: e.title,
        date: s.date,
        start: s.time,
        end: en.time,
        location: e.location ?? "",
        notes: e.notes ?? "",
        spots: e.spots,
        withAc: e.withAc,
        allDay: e.allDay,
        inSeries: !!e.seriesId,
      }}
    />
  );
}
