import type { CalEvent } from "@/lib/data";
import { addDays, dayKey } from "@/lib/dates";

export type { CalEvent };
export type EventType = CalEvent["type"];

export const TYPES: { key: EventType; label: string; short: string; color: string }[] = [
  { key: "tour", label: "Tours", short: "Tour", color: "var(--color-tour)" },
  { key: "event", label: "Events", short: "Event", color: "var(--color-event)" },
  { key: "hs_visit", label: "High school visits", short: "HS visit", color: "var(--color-hs)" },
  { key: "calendar", label: "Outlook calendar", short: "Outlook", color: "var(--color-cal)" },
];

export const typeMeta = (t: EventType) => TYPES.find((x) => x.key === t)!;

export const filled = (e: CalEvent) => e.people.length;
export const isMine = (e: CalEvent, me: string) => e.people.some((p) => p.id === me);
export const isPast = (e: CalEvent, now: number) => new Date(e.startsAt).getTime() <= now;
export const takesSignups = (e: CalEvent) => e.spots != null;
export const spotsLeft = (e: CalEvent) => (e.spots == null ? 0 : Math.max(0, e.spots - filled(e)));
export const isOpen = (e: CalEvent, now: number) => takesSignups(e) && !isPast(e, now) && spotsLeft(e) > 0;

/**
 * Days (YYYY-MM-DD, Utah) an item appears on. Multi-day all-day items show on each day,
 * except sign-up items (e.g. "Social media · Week of 10/12") which show once, on their first day.
 */
export function daysOf(e: CalEvent): string[] {
  const start = dayKey(e.startsAt);
  if (!e.allDay || e.spots != null) return [start];
  const end = dayKey(new Date(new Date(e.endsAt).getTime() - 1));
  const out: string[] = [];
  for (let d = start; d <= end && out.length < 31; d = addDays(d, 1)) out.push(d);
  return out;
}

export function groupByDay(events: CalEvent[]): Map<string, CalEvent[]> {
  const map = new Map<string, CalEvent[]>();
  for (const e of events) {
    for (const d of daysOf(e)) {
      const list = map.get(d) ?? [];
      list.push(e);
      map.set(d, list);
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startsAt.localeCompare(b.startsAt));
  }
  return map;
}
