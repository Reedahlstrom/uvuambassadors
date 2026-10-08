// Requirement math. Pure functions — used on both server and client.

export type ReqKey = "tour" | "event" | "hs_visit" | "hs_visit_ac";
export type Reqs = Record<ReqKey, number>;
export type Tally = Record<ReqKey, { done: number; scheduled: number }>;
export type Status = "complete" | "on_track" | "behind";

export const REQ_KEYS: ReqKey[] = ["tour", "event", "hs_visit", "hs_visit_ac"];

export const REQ_LABEL: Record<ReqKey, string> = {
  tour: "Tours",
  event: "Events",
  hs_visit: "HS visits",
  hs_visit_ac: "With AC",
};

export const STATUS_LABEL: Record<Status, string> = {
  complete: "Complete",
  on_track: "On track",
  behind: "Behind",
};

export type SignupForTally = {
  type: string;
  withAc: boolean;
  endsAt: Date | string;
  status: "going" | "no_show";
};

export function emptyTally(): Tally {
  return {
    tour: { done: 0, scheduled: 0 },
    event: { done: 0, scheduled: 0 },
    hs_visit: { done: 0, scheduled: 0 },
    hs_visit_ac: { done: 0, scheduled: 0 },
  };
}

/** A sign-up counts as "done" once the event has ended (unless marked no-show). */
export function tally(list: SignupForTally[], now = new Date()): Tally {
  const t = emptyTally();
  for (const s of list) {
    if (s.status === "no_show") continue;
    if (s.type !== "tour" && s.type !== "event" && s.type !== "hs_visit") continue;
    const bucket = new Date(s.endsAt) <= now ? "done" : "scheduled";
    t[s.type][bucket]++;
    if (s.type === "hs_visit" && s.withAc) t.hs_visit_ac[bucket]++;
  }
  return t;
}

export function remaining(t: Tally, reqs: Reqs): Reqs {
  const r = {} as Reqs;
  for (const k of REQ_KEYS) r[k] = Math.max(0, reqs[k] - t[k].done - t[k].scheduled);
  return r;
}

export function semesterElapsed(startsOn: string, endsOn: string, now = new Date()): number {
  const s = new Date(startsOn + "T00:00:00Z").getTime();
  const e = new Date(endsOn + "T23:59:59Z").getTime();
  if (e <= s) return 1;
  return Math.min(1, Math.max(0, (now.getTime() - s) / (e - s)));
}

/**
 * complete  = every requirement done
 * on_track  = done + signed up keeps pace with how far into the semester we are
 * behind    = falling behind pace on at least one requirement
 */
export function statusOf(t: Tally, reqs: Reqs, elapsed: number): Status {
  if (REQ_KEYS.every((k) => t[k].done >= reqs[k])) return "complete";
  for (const k of REQ_KEYS) {
    const have = t[k].done + t[k].scheduled;
    const expected = Math.floor(reqs[k] * elapsed);
    if (have < expected) return "behind";
  }
  return "on_track";
}

/** "2 tours, 1 event and 1 high school visit (with an AC)" */
export function needsSentence(t: Tally, reqs: Reqs): string {
  const r = remaining(t, reqs);
  const parts: string[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (r.tour) parts.push(plural(r.tour, "tour", "tours"));
  if (r.event) parts.push(plural(r.event, "event", "events"));
  if (r.hs_visit || r.hs_visit_ac) {
    const hs = Math.max(r.hs_visit, r.hs_visit_ac);
    let s = plural(hs, "high school visit", "high school visits");
    if (r.hs_visit_ac) s += ` (${r.hs_visit_ac} with an AC)`;
    parts.push(s);
  }
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
}
