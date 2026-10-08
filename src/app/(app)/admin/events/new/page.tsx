import { requireRole } from "@/lib/auth";
import { todayKey } from "@/lib/dates";
import { EventForm } from "../event-form";

export default async function NewEventPage() {
  await requireRole("admin");
  return <EventForm today={todayKey()} />;
}
