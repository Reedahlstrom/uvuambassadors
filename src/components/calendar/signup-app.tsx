"use client";

import { useMemo, useState } from "react";
import { remaining, type Reqs } from "@/lib/progress";
import { NeedsLine, ProgressCard } from "../progress-card";
import { ButtonLink, Card, cx } from "../ui";
import { DayGroup, useMyProgress } from "./calendar-app";
import { EventPanel } from "./event-panel";
import { groupByDay, isMine, isOpen, typeMeta, type CalEvent, type EventType } from "./shared";

type Filter = "all" | Exclude<EventType, "calendar">;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tour", label: "Tours" },
  { key: "event", label: "Events" },
  { key: "hs_visit", label: "HS visits" },
];

/** Everything that still has an open spot, soonest first, with a Sign up button on each. */
export function SignupApp({
  events,
  me,
  role,
  semester,
  reqs,
  everyone,
  today,
}: {
  events: CalEvent[];
  me: string;
  role: "ambassador" | "manager" | "admin";
  semester: { name: string; startsOn: string; endsOn: string };
  reqs: Reqs;
  everyone: { id: string; name: string }[];
  today: string;
}) {
  const [now] = useState(() => Date.now());
  // What was open (and not yours) when the page loaded. It stays put after you sign up, showing "You're in".
  const [shown] = useState(() => new Set(events.filter((e) => isOpen(e, now) && !isMine(e, me)).map((e) => e.id)));
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const progress = useMyProgress(events, me, semester, reqs);
  const isAmb = role === "ambassador";
  const left = remaining(progress.tally, reqs);
  const need: Record<Filter, number> = { all: 0, tour: left.tour, event: left.event, hs_visit: Math.max(left.hs_visit, left.hs_visit_ac) };

  const open = useMemo(() => events.filter((e) => shown.has(e.id) && e.type !== "calendar"), [events, shown]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, tour: 0, event: 0, hs_visit: 0 };
    for (const e of open) {
      if (!isOpen(e, now)) continue;
      c.all++;
      c[e.type as Filter]++;
    }
    return c;
  }, [open, now]);
  const visible = filter === "all" ? open : open.filter((e) => e.type === filter);
  const byDay = useMemo(() => groupByDay(visible), [visible]);
  const days = [...byDay.keys()].sort();
  const selected = selectedId ? events.find((e) => e.id === selectedId) : null;

  return (
    <div className="flex gap-6">
      {isAmb && (
        <aside className="sticky top-24 hidden w-[272px] shrink-0 self-start lg:block">
          <ProgressCard title={semester.name} tally={progress.tally} reqs={reqs} status={progress.status} />
        </aside>
      )}

      <section className="min-w-0 flex-1">
        <h1 className="font-display mb-4 text-[34px] leading-none text-ink sm:text-[40px]">Sign up</h1>

        {isAmb && (
          <Card className="mb-4 px-4 py-3 lg:hidden">
            <NeedsLine tally={progress.tally} reqs={reqs} status={progress.status} />
          </Card>
        )}

        <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const color = f.key === "all" ? "var(--color-brand)" : typeMeta(f.key).color;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cx(
                  "flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[15px] font-medium transition-colors",
                  active ? "border-transparent text-white" : "border-line bg-white text-ink-2 hover:bg-canvas",
                )}
                style={active ? { background: color } : undefined}
              >
                {f.key !== "all" && !active && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
                {f.label}
                <span className={cx("tabular-nums", active ? "text-white/80" : "text-muted")}>{counts[f.key]}</span>
                {isAmb && need[f.key] > 0 && (
                  <span
                    className={cx(
                      "rounded-full px-2 py-0.5 text-[12px] font-semibold",
                      active ? "bg-white/20 text-white" : "bg-warn-soft text-warn",
                    )}
                  >
                    need {need[f.key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {days.length ? (
          <div className="space-y-6">
            {days.map((d, i) => (
              <div key={d}>
                {d > semester.endsOn && (i === 0 || days[i - 1] <= semester.endsOn) && (
                  <p className="mb-5 flex items-center gap-3 text-[13px] font-semibold tracking-wide text-muted uppercase">
                    Next semester <span className="h-px flex-1 bg-line" />
                  </p>
                )}
                <DayGroup day={d} today={today} events={byDay.get(d)!} me={me} now={now} onSelect={setSelectedId} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center">
            <p className="text-muted">{filter === "all" ? "No open spots right now." : `No open ${FILTERS.find((f) => f.key === filter)!.label.toLowerCase()} right now.`}</p>
            <ButtonLink href="/calendar" variant="secondary" className="mt-4">
              See the calendar
            </ButtonLink>
          </div>
        )}
      </section>

      {selected && (
        <EventPanel event={selected} me={me} isAdmin={role === "admin"} now={now} everyone={everyone} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
