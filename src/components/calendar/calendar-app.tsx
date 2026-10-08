"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, SlidersHorizontal, X } from "lucide-react";
import { addDays, addMonths, dateShort, dateToUtah, dayKey, monthTitle, timeRange, timeShort, utahToDate, weekdayOf } from "@/lib/dates";
import { semesterElapsed, statusOf, tally, type Reqs } from "@/lib/progress";
import { ProgressCard, ProgressStrip } from "../progress-card";
import { Button, cx } from "../ui";
import { EventPanel, useSignupActions } from "./event-panel";
import { signUp } from "@/app/actions/signups";
import { moveEvent } from "@/app/actions/admin";
import {
  groupByDay,
  isMine,
  isOpen,
  isPast,
  spotsLeft,
  takesSignups,
  typeMeta,
  TYPES,
  type CalEvent,
  type EventType,
} from "./shared";

type View = "month" | "week" | "list";
type Show = "all" | "mine" | "open";
type Prefs = { view: View; show: Show; types: Record<EventType, boolean> };

const DEFAULT_PREFS: Prefs = { view: "month", show: "all", types: { tour: true, event: true, hs_visit: true, calendar: true } };
const PREFS_KEY = "ua.calendar.v1";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarApp({
  events,
  me,
  role,
  semester,
  reqs,
  everyone,
  today,
  initialShow,
}: {
  events: CalEvent[];
  me: string;
  role: "ambassador" | "manager" | "admin";
  semester: { name: string; startsOn: string; endsOn: string };
  reqs: Reqs;
  everyone: { id: string; name: string }[];
  today: string;
  initialShow?: Show;
}) {
  const [now] = useState(() => Date.now());
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [cursor, setCursor] = useState(today);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDay, setMobileDay] = useState(today);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Admin drag and drop: show the move right away, the server catches up
  const [moved, setMoved] = useState<Record<string, string>>({});
  const { run: runMove } = useSignupActions();
  const canMove = role === "admin";
  const moveTo = (id: string, day: string) => {
    const e = events.find((x) => x.id === id);
    // One move at a time per item; compare with where it's shown now
    if (!e || id in moved || dayKey(e.startsAt) === day) return;
    setMoved((m) => ({ ...m, [id]: day }));
    runMove(id, () => moveEvent(id, day), () =>
      setMoved((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      }),
    );
  };
  const shown = useMemo(
    () =>
      events.map((e) => {
        const day = moved[e.id];
        if (!day) return e;
        // Same Utah wall-clock times on the new day (matches the server, DST-safe)
        const a = dateToUtah(e.startsAt);
        const b = dateToUtah(e.endsAt);
        const span = Math.round((new Date(b.date + "T12:00:00Z").getTime() - new Date(a.date + "T12:00:00Z").getTime()) / 86_400_000);
        return {
          ...e,
          startsAt: utahToDate(day, a.time).toISOString(),
          endsAt: utahToDate(addDays(day, span), b.time).toISOString(),
        };
      }),
    [events, moved],
  );

  // Remember view + filters on this device
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      const base = saved ? { ...DEFAULT_PREFS, ...JSON.parse(saved) } : DEFAULT_PREFS;
      setPrefs(initialShow ? { ...base, show: initialShow, view: "list" } : base);
    } catch {
      if (initialShow) setPrefs({ ...DEFAULT_PREFS, show: initialShow, view: "list" });
    }
  }, [initialShow]);
  const update = (p: Partial<Prefs>) =>
    setPrefs((old) => {
      const next = { ...old, ...p };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

  const visible = useMemo(
    () =>
      shown.filter((e) => {
        if (!prefs.types[e.type]) return false;
        if (prefs.show === "mine") return isMine(e, me);
        if (prefs.show === "open") return isOpen(e, now);
        return true;
      }),
    [shown, prefs, me, now],
  );
  const byDay = useMemo(() => groupByDay(visible), [visible]);

  const myProgress = useMyProgress(events, me, semester, reqs);

  const selected = selectedId ? shown.find((e) => e.id === selectedId) : null;
  const showProgress = role === "ambassador";

  // ----- navigation -----
  const monthStart = cursor.slice(0, 8) + "01";
  const weekStart = addDays(cursor, -weekdayOf(cursor));
  const go = (dir: -1 | 1) => {
    if (prefs.view === "month") {
      const next = addMonths(monthStart, dir);
      setCursor(next);
      setMobileDay(next.slice(0, 7) === today.slice(0, 7) ? today : next);
    } else setCursor(addDays(cursor, dir * 7));
  };
  const goToday = () => {
    setCursor(today);
    setMobileDay(today);
  };
  const title =
    prefs.view === "month"
      ? monthTitle(monthStart)
      : prefs.view === "week"
        ? weekTitle(weekStart)
        : "Coming up";

  const filterPanel = <Filters prefs={prefs} update={update} />;
  const onlyType = TYPES.filter((t) => prefs.types[t.key]);
  const pickType = (type: EventType) => {
    update({ show: "all", types: { tour: false, event: false, hs_visit: false, calendar: false, [type]: true } });
    setFiltersOpen(false);
  };
  const showEverything = () => update({ show: "all", types: DEFAULT_PREFS.types });

  return (
    <div className="flex gap-6">
      {/* ---------- Left side ---------- */}
      <aside className="sticky top-24 hidden w-[272px] shrink-0 space-y-4 self-start lg:block">
        {showProgress && (
          <ProgressCard title={semester.name} tally={myProgress.tally} reqs={reqs} status={myProgress.status} onPick={pickType} />
        )}
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">{filterPanel}</div>
      </aside>

      {/* ---------- Main ---------- */}
      <section className="min-w-0 flex-1">
        {showProgress && (
          <div className="mb-4 lg:hidden">
            <ProgressStrip tally={myProgress.tally} reqs={reqs} status={myProgress.status} />
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {prefs.view !== "list" && (
            <div className="flex items-center">
              <button onClick={() => go(-1)} className="rounded-xl p-2 text-ink-2 hover:bg-white" aria-label="Previous">
                <ChevronLeft size={22} />
              </button>
              <button onClick={() => go(1)} className="rounded-xl p-2 text-ink-2 hover:bg-white" aria-label="Next">
                <ChevronRight size={22} />
              </button>
            </div>
          )}
          <h1 className="font-display mr-auto text-[30px] leading-none text-ink sm:text-[36px]">{title}</h1>
          {prefs.view !== "list" && (
            <Button variant="outline" size="sm" onClick={goToday}>
              Today
            </Button>
          )}
          <Segmented
            value={prefs.view}
            onChange={(v) => update({ view: v as View })}
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
              { value: "list", label: "List" },
            ]}
          />
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)} aria-label="Filters">
            <SlidersHorizontal size={16} />
            <span className="hidden sm:inline">Filters</span>
          </Button>
        </div>

        {onlyType.length === 1 && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-soft">
            <span className="h-2 w-2 rounded-full" style={{ background: onlyType[0].color }} />
            <span className="font-medium text-ink">{onlyType[0].label} only</span>
            <button onClick={showEverything} className="ml-auto font-medium text-brand hover:underline">
              Show everything
            </button>
          </div>
        )}

        {prefs.view === "month" && (
          <>
            <MonthGrid
              monthStart={monthStart}
              today={today}
              byDay={byDay}
              me={me}
              now={now}
              onSelect={setSelectedId}
              onMore={setDayOpen}
              mobileDay={mobileDay}
              setMobileDay={setMobileDay}
              onMove={canMove ? moveTo : undefined}
            />
            <Legend canMove={canMove} />
            <div className="mt-4 md:hidden">
              <DayGroup day={mobileDay} today={today} events={byDay.get(mobileDay) ?? []} me={me} now={now} onSelect={setSelectedId} showEmpty />
            </div>
          </>
        )}

        {prefs.view === "week" && (
          <>
            <WeekView weekStart={weekStart} today={today} byDay={byDay} me={me} now={now} onSelect={setSelectedId} onMove={canMove ? moveTo : undefined} />
            <Legend canMove={canMove} />
          </>
        )}

        {prefs.view === "list" && <ListView today={today} byDay={byDay} me={me} now={now} onSelect={setSelectedId} />}
      </section>

      {/* ---------- Overlays ---------- */}
      {selected && (
        <EventPanel event={selected} me={me} isAdmin={role === "admin"} now={now} everyone={everyone} onClose={() => setSelectedId(null)} />
      )}

      {dayOpen && !selected && (
        <Sheet onClose={() => setDayOpen(null)} title={dateShort(dayOpen + "T18:00:00Z")}>
          <DayGroup day={dayOpen} today={today} events={byDay.get(dayOpen) ?? []} me={me} now={now} onSelect={setSelectedId} hideHeader />
        </Sheet>
      )}

      {filtersOpen && (
        <Sheet onClose={() => setFiltersOpen(false)} title="Filters">
          {filterPanel}
        </Sheet>
      )}
    </div>
  );
}

export function useMyProgress(events: CalEvent[], me: string, semester: { startsOn: string; endsOn: string }, reqs: Reqs) {
  return useMemo(() => {
    const mine = events
      .filter((e) => isMine(e, me) && dayKey(e.startsAt) >= semester.startsOn && dayKey(e.startsAt) <= semester.endsOn)
      .map((e) => ({ type: e.type, withAc: e.withAc, endsAt: e.endsAt, status: e.people.find((p) => p.id === me)!.status }));
    const t = tally(mine);
    return { tally: t, status: statusOf(t, reqs, semesterElapsed(semester.startsOn, semester.endsOn)) };
  }, [events, me, semester, reqs]);
}

function weekTitle(start: string) {
  const end = addDays(start, 6);
  const a = dateShort(start + "T18:00:00Z").split(", ")[1];
  const b = dateShort(end + "T18:00:00Z").split(", ")[1];
  return a.split(" ")[0] === b.split(" ")[0] ? `${a} – ${b.split(" ")[1]}` : `${a} – ${b}`;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

function Filters({ prefs, update }: { prefs: Prefs; update: (p: Partial<Prefs>) => void }) {
  return (
    <div>
      <p className="mb-2.5 text-[13px] font-semibold tracking-wide text-muted uppercase">Show</p>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-canvas p-1">
        {(
          [
            ["all", "All"],
            ["mine", "Mine"],
            ["open", "Open"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => update({ show: v })}
            className={cx(
              "h-9 rounded-lg text-sm font-medium transition-colors",
              prefs.show === v ? "bg-white text-brand shadow-soft" : "text-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-6 mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">Calendars</p>
      <div className="space-y-0.5">
        {TYPES.map((t) => {
          const on = prefs.types[t.key];
          return (
            <label key={t.key} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-canvas">
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                onChange={() => update({ types: { ...prefs.types, [t.key]: !on } })}
              />
              <span
                className="flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors"
                style={{ borderColor: t.color, background: on ? t.color : "white" }}
              >
                {on && <Check size={13} strokeWidth={3} className="text-white" />}
              </span>
              <span className="text-[15px] text-ink">{t.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex rounded-xl border border-line bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-8 rounded-[10px] px-3 text-sm font-medium transition-colors",
            value === o.value ? "bg-brand-soft text-brand" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Legend({ canMove }: { canMove?: boolean }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1 text-[13px] text-muted">
      <span className="flex items-center gap-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded bg-brand text-white">
          <Check size={11} strokeWidth={3} />
        </span>
        You&apos;re in
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-brand" /> Open, tap to sign up
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full border border-faint" /> Grey = full or already happened, tap for details
      </span>
      {canMove && <span className="hidden md:inline">Drag to change the date · + to add</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month
// ---------------------------------------------------------------------------

function MonthGrid({
  monthStart,
  today,
  byDay,
  me,
  now,
  onSelect,
  onMore,
  mobileDay,
  setMobileDay,
  onMove,
}: {
  monthStart: string;
  today: string;
  byDay: Map<string, CalEvent[]>;
  me: string;
  now: number;
  onSelect: (id: string) => void;
  onMore: (day: string) => void;
  mobileDay: string;
  setMobileDay: (d: string) => void;
  onMove?: (id: string, day: string) => void;
}) {
  const drop = useDrop(onMove);
  const first = weekdayOf(monthStart);
  const gridStart = addDays(monthStart, -first);
  const nextMonth = addMonths(monthStart, 1);
  let rows = 0;
  while (addDays(gridStart, rows * 7) < nextMonth) rows++;
  const days = Array.from({ length: rows * 7 }, (_, i) => addDays(gridStart, i));
  const MAX = 4;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2.5 text-center text-xs font-medium tracking-wide text-muted uppercase">
            <span className="md:hidden">{d[0]}</span>
            <span className="hidden md:inline">{d}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const inMonth = d.slice(0, 7) === monthStart.slice(0, 7);
          const list = byDay.get(d) ?? [];
          const isToday = d === today;
          const lastCol = i % 7 === 6;
          const lastRow = i >= days.length - 7;
          return (
            <div
              key={d}
              {...drop.target(d)}
              className={cx(
                "group/day relative min-w-0",
                !lastCol && "border-r border-line",
                !lastRow && "border-b border-line",
                !inMonth && "bg-[#fafafa]",
                drop.over === d && "bg-brand-soft ring-2 ring-brand ring-inset",
              )}
            >
              {/* Phone: compact cell */}
              <button
                onClick={() => setMobileDay(d)}
                className={cx("flex h-14 w-full flex-col items-center pt-1.5 md:hidden", mobileDay === d && "bg-brand-soft/60")}
              >
                <DayNumber d={d} isToday={isToday} inMonth={inMonth} />
                <span className="mt-1 flex h-3 items-center gap-0.5">
                  {list.slice(0, 4).map((e) =>
                    isMine(e, me) ? (
                      <Check key={e.id} size={12} strokeWidth={3.5} style={{ color: typeMeta(e.type).color }} />
                    ) : takesSignups(e) && spotsLeft(e) === 0 ? (
                      <span key={e.id} className="h-1.5 w-1.5 rounded-full border border-faint" />
                    ) : (
                      <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ background: typeMeta(e.type).color }} />
                    ),
                  )}
                </span>
              </button>

              {/* Desktop: chips */}
              <div className="hidden min-h-[132px] p-1.5 md:block">
                <div className="mb-1 flex items-center justify-between px-1">
                  {onMove ? (
                    <Link
                      href={`/admin/events/new?date=${d}`}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted opacity-0 group-hover/day:opacity-100 hover:bg-brand-soft hover:text-brand"
                      aria-label="Add on this day"
                      title="Add on this day"
                    >
                      <Plus size={15} />
                    </Link>
                  ) : (
                    <span />
                  )}
                  <DayNumber d={d} isToday={isToday} inMonth={inMonth} />
                </div>
                <div className="space-y-[3px]">
                  {list.slice(0, list.length > MAX ? MAX - 1 : MAX).map((e) => (
                    <Chip key={e.id + d} e={e} me={me} now={now} onClick={() => onSelect(e.id)} drag={drop.source(e)} />
                  ))}
                  {list.length > MAX && (
                    <button onClick={() => onMore(d)} className="w-full rounded-md px-1.5 py-0.5 text-left text-xs font-medium text-muted hover:bg-canvas hover:text-ink">
                      +{list.length - (MAX - 1)} more
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayNumber({ d, isToday, inMonth }: { d: string; isToday: boolean; inMonth: boolean }) {
  return (
    <span
      className={cx(
        "flex h-7 w-7 items-center justify-center rounded-full text-[13px] tabular-nums",
        isToday ? "bg-brand font-semibold text-white" : inMonth ? "font-medium text-ink-2" : "text-faint",
      )}
    >
      {Number(d.slice(8))}
    </span>
  );
}

function Chip({ e, me, now, onClick, drag }: { e: CalEvent; me: string; now: number; onClick: () => void; drag?: DragProps }) {
  const meta = typeMeta(e.type);
  const mine = isMine(e, me);
  const full = takesSignups(e) && spotsLeft(e) === 0 && !mine;
  const past = isPast(e, now);
  const muted = full || (past && !mine);
  const status = mine ? "You're in" : past ? "" : full ? "Full" : takesSignups(e) ? `${spotsLeft(e)} open` : "";
  return (
    <button
      onClick={onClick}
      {...drag}
      title={`${e.allDay ? "" : timeShort(e.startsAt) + " "}${e.title}${status ? ` · ${status}` : ""}`}
      className={cx(
        "flex w-full items-center gap-1.5 overflow-hidden rounded-md px-1.5 py-[3px] text-left text-[12.5px] leading-tight transition hover:brightness-95",
        drag?.draggable && "cursor-grab active:cursor-grabbing",
        past && !mine && "opacity-60",
      )}
      style={
        mine
          ? { background: meta.color, color: "white" }
          : muted
            ? { background: "var(--color-canvas)", color: "var(--color-faint)" }
            : { background: `color-mix(in srgb, ${meta.color} 18%, white)`, color: "var(--color-ink)", boxShadow: `inset 2px 0 0 ${meta.color}` }
      }
    >
      {mine ? (
        <Check size={12} strokeWidth={3} className="shrink-0" />
      ) : muted ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-faint" />
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.color }} />
      )}
      {!e.allDay && <span className={cx("shrink-0 tabular-nums", mine ? "text-white/85" : "text-muted")}>{timeShort(e.startsAt)}</span>}
      <span className={cx("truncate", !muted && "font-medium")}>{e.title}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Drag and drop (admins, desktop): move an item to another day
// ---------------------------------------------------------------------------

type DragProps = { draggable: boolean; onDragStart?: (ev: React.DragEvent) => void };
const DRAG_TYPE = "application/x-ua-event";

function useDrop(onMove?: (id: string, day: string) => void) {
  const [over, setOver] = useState<string | null>(null);
  return {
    over,
    source: (e: CalEvent): DragProps | undefined =>
      onMove && e.source !== "outlook"
        ? {
            draggable: true,
            onDragStart: (ev) => {
              ev.dataTransfer.setData(DRAG_TYPE, e.id);
              ev.dataTransfer.effectAllowed = "move";
            },
          }
        : undefined,
    target: (day: string) =>
      onMove
        ? {
            onDragOver: (ev: React.DragEvent) => {
              if (!ev.dataTransfer.types.includes(DRAG_TYPE)) return;
              ev.preventDefault();
              ev.dataTransfer.dropEffect = "move";
              if (over !== day) setOver(day);
            },
            onDragLeave: (ev: React.DragEvent) => {
              if (!(ev.currentTarget as HTMLElement).contains(ev.relatedTarget as Node)) setOver((o) => (o === day ? null : o));
            },
            onDrop: (ev: React.DragEvent) => {
              ev.preventDefault();
              setOver(null);
              const id = ev.dataTransfer.getData(DRAG_TYPE);
              if (id) onMove(id, day);
            },
          }
        : {},
  };
}

// ---------------------------------------------------------------------------
// Week
// ---------------------------------------------------------------------------

function WeekView({
  weekStart,
  today,
  byDay,
  me,
  now,
  onSelect,
  onMove,
}: {
  weekStart: string;
  today: string;
  byDay: Map<string, CalEvent[]>;
  me: string;
  now: number;
  onSelect: (id: string) => void;
  onMove?: (id: string, day: string) => void;
}) {
  const drop = useDrop(onMove);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <>
      <div className="hidden grid-cols-7 gap-2 md:grid">
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          const isToday = d === today;
          return (
            <div key={d} {...drop.target(d)} className={cx("min-h-[200px] min-w-0 rounded-xl", drop.over === d && "bg-brand-soft ring-2 ring-brand")}>
              <div className={cx("mb-2 rounded-xl px-2 py-2 text-center", isToday ? "bg-brand text-white" : "text-ink-2")}>
                <p className={cx("text-xs font-medium uppercase", isToday ? "text-white/80" : "text-muted")}>{WEEKDAYS[weekdayOf(d)]}</p>
                <p className="text-lg font-semibold tabular-nums">{Number(d.slice(8))}</p>
              </div>
              <div className="space-y-2">
                {list.map((e) => (
                  <WeekCard key={e.id} e={e} me={me} now={now} onClick={() => onSelect(e.id)} drag={drop.source(e)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="space-y-5 md:hidden">
        {days.map((d) => (
          <DayGroup key={d} day={d} today={today} events={byDay.get(d) ?? []} me={me} now={now} onSelect={onSelect} showEmpty />
        ))}
      </div>
    </>
  );
}

function WeekCard({ e, me, now, onClick, drag }: { e: CalEvent; me: string; now: number; onClick: () => void; drag?: DragProps }) {
  const meta = typeMeta(e.type);
  const mine = isMine(e, me);
  const left = spotsLeft(e);
  const past = isPast(e, now);
  return (
    <button
      onClick={onClick}
      {...drag}
      className={cx(
        "w-full rounded-xl border p-2.5 text-left transition hover:shadow-soft",
        drag?.draggable && "cursor-grab active:cursor-grabbing",
        mine ? "border-transparent text-white" : "border-line bg-white",
        past && !mine && "opacity-60",
      )}
      style={mine ? { background: meta.color } : { borderLeft: `3px solid ${meta.color}` }}
    >
      <p className={cx("text-xs tabular-nums", mine ? "text-white/85" : "text-muted")}>{timeRange(e.startsAt, e.endsAt, e.allDay)}</p>
      <p className="mt-0.5 text-[13.5px] leading-snug font-semibold">{e.title}</p>
      {takesSignups(e) && (
        <p className={cx("mt-1 text-xs", mine ? "text-white/90" : left > 0 ? "text-ink-2" : "text-muted")}>
          {mine ? "✓ You're in" : past ? "" : left > 0 ? `${left} open` : "Full"}
        </p>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

function ListView({
  today,
  byDay,
  me,
  now,
  onSelect,
}: {
  today: string;
  byDay: Map<string, CalEvent[]>;
  me: string;
  now: number;
  onSelect: (id: string) => void;
}) {
  const [limit, setLimit] = useState(21);
  // "Coming up" = anything that hasn't ended yet
  const upcoming = (d: string) => (byDay.get(d) ?? []).filter((e) => new Date(e.endsAt).getTime() > now);
  const days = [...byDay.keys()].filter((d) => d >= today && upcoming(d).length > 0).sort();
  if (days.length === 0) return <p className="rounded-2xl border border-dashed border-line bg-white py-14 text-center text-muted">Nothing here.</p>;
  return (
    <div className="space-y-6">
      {days.slice(0, limit).map((d) => (
        <DayGroup key={d} day={d} today={today} events={upcoming(d)} me={me} now={now} onSelect={onSelect} />
      ))}
      {days.length > limit && (
        <div className="text-center">
          <Button variant="secondary" onClick={() => setLimit((l) => l + 21)}>
            Show more
          </Button>
        </div>
      )}
    </div>
  );
}

function dayLabel(day: string, today: string) {
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  return dateShort(day + "T18:00:00Z");
}

export function DayGroup({
  day,
  today,
  events,
  me,
  now,
  onSelect,
  showEmpty,
  hideHeader,
}: {
  day: string;
  today: string;
  events: CalEvent[];
  me: string;
  now: number;
  onSelect: (id: string) => void;
  showEmpty?: boolean;
  hideHeader?: boolean;
}) {
  if (!events.length && !showEmpty) return null;
  return (
    <div>
      {!hideHeader && (
        <p className={cx("mb-2 px-1 text-sm font-semibold", day === today ? "text-brand" : "text-ink-2")}>{dayLabel(day, today)}</p>
      )}
      {events.length ? (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          {events.map((e) => (
            <EventRow key={e.id} e={e} me={me} now={now} onClick={() => onSelect(e.id)} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-faint">Nothing scheduled</p>
      )}
    </div>
  );
}

export function EventRow({ e, me, now, onClick }: { e: CalEvent; me: string; now: number; onClick: () => void }) {
  const meta = typeMeta(e.type);
  const mine = isMine(e, me);
  const past = isPast(e, now);
  const left = spotsLeft(e);
  const { pendingId, run } = useSignupActions();
  const busy = pendingId === e.id;

  return (
    <div className={cx("flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4", past && !mine && "opacity-60")}>
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4">
        <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: meta.color }} />
        <span className="w-[68px] shrink-0 text-[13px] leading-tight text-muted tabular-nums sm:w-[84px]">
          {e.allDay ? (
            "All day"
          ) : (
            <>
              {timeShort(e.startsAt)}
              <br />
              {timeShort(e.endsAt)}
            </>
          )}
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 block text-[15px] leading-snug font-semibold text-ink sm:truncate">{e.title}</span>
          <span className="flex items-center gap-1.5 truncate text-[13px] text-muted">
            {meta.short}
            {e.withAc && <span className="font-medium text-hs">· With AC</span>}
            {!mine && !past && takesSignups(e) && left > 0 && (
              <span className="shrink-0 font-medium text-brand">
                · {left} {left === 1 ? "spot" : "spots"} left
              </span>
            )}
            {e.location && e.location !== e.title && <span className="truncate">· {e.location}</span>}
          </span>
        </span>
      </button>
      <div className="shrink-0">
        {mine ? (
          <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-good-soft px-3 text-sm font-medium text-good">
            <Check size={15} strokeWidth={2.5} /> {past ? "Done" : "You're in"}
          </span>
        ) : !takesSignups(e) || past ? null : left > 0 ? (
          <Button size="sm" disabled={busy} onClick={() => run(e.id, () => signUp(e.id))}>
            {busy ? "…" : "Sign up"}
          </Button>
        ) : (
          <span className="inline-flex h-9 items-center px-3 text-sm text-faint">Full</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sheet (phone filters, "+N more")
// ---------------------------------------------------------------------------

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
      <button className="anim-fade absolute inset-0 bg-ink/25" onClick={onClose} aria-label="Close" />
      <div className="anim-sheet thin-scroll absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-pop md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[480px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-lg font-semibold text-ink">{title}</p>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-canvas" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
