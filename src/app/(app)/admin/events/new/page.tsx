import { requireRole } from "@/lib/auth";
import { todayKey } from "@/lib/dates";
import { EventForm } from "../event-form";

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireRole("admin");
  const { date } = await searchParams;
  const today = todayKey();
  // "+" on a calendar day opens this with that day filled in
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  return <EventForm today={today} initialDate={day} />;
}
