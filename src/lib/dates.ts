import { TZDate } from "@date-fns/tz";
import { TIMEZONE } from "./config";

// Safe on both server and client. Everything formats in Utah time.

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, ...opts });
    fmtCache.set(key, f);
  }
  return f;
}

/** "2026-10-06" for the Utah calendar day of an instant */
export function dayKey(d: Date | string): string {
  const parts = fmt({ year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(d));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "10:00 AM" → "10am", "2:30 PM" → "2:30pm" */
export function timeShort(d: Date | string): string {
  const s = fmt({ hour: "numeric", minute: "2-digit" }).format(new Date(d));
  return s.replace(":00", "").replace(" AM", "am").replace(" PM", "pm");
}

export function timeRange(start: Date | string, end: Date | string, allDay = false): string {
  if (allDay) return "All day";
  return `${timeShort(start)} – ${timeShort(end)}`;
}

/** "Tue, Oct 6" */
export function dateShort(d: Date | string): string {
  return fmt({ weekday: "short", month: "short", day: "numeric" }).format(new Date(d));
}

/** "Tuesday, October 6" */
export function dateLong(d: Date | string): string {
  return fmt({ weekday: "long", month: "long", day: "numeric" }).format(new Date(d));
}

/** "October 2026" for a "2026-10-01" style key */
export function monthTitle(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Utah wall-clock date + time → real instant. date "2026-10-06", time "14:30" */
export function utahToDate(date: string, time = "00:00"): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh || 0, mm || 0, TIMEZONE).getTime());
}

/** Instant → { date: "2026-10-06", time: "14:30" } in Utah time (for form defaults) */
export function dateToUtah(d: Date | string): { date: string; time: string } {
  const parts = fmt({ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(d));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Pure calendar-day math on "YYYY-MM-DD" keys (no timezone involved) */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function weekdayOf(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return t.toISOString().slice(0, 10);
}

export function todayKey(): string {
  return dayKey(new Date());
}
