import { Bar, StatusPill, cx } from "./ui";
import { needsSentence, type Reqs, type Status, type Tally } from "@/lib/progress";

/** "Still need 4 events and 1 high school visit" — or what's left once everything is covered */
export function NeedsLine({ tally, reqs, status, className }: { tally: Tally; reqs: Reqs; status: Status; className?: string }) {
  const needs = needsSentence(tally, reqs);
  return (
    <p className={cx("text-[14px] leading-snug", needs ? "text-ink-2" : "text-good", className)}>
      {needs ? (
        <>
          Still need <b className="font-semibold text-ink">{needs}</b>
        </>
      ) : status === "complete" ? (
        "All done this semester"
      ) : (
        "You're signed up for everything you need"
      )}
    </p>
  );
}

/** "5 +2 /7": done (solid), signed up but not done yet (light), required */
export function DoneCount({ done, scheduled, need, color }: { done: number; scheduled: number; need: number; color: string }) {
  return (
    <span className="tabular-nums" title={`${done} done · ${scheduled} signed up · ${need} needed`}>
      <b className={cx("font-semibold", done >= need ? "text-brand" : "text-ink")}>{Math.min(done, 99)}</b>
      {scheduled > 0 && (
        <span className="ml-1 font-medium" style={{ color: `color-mix(in srgb, ${color} 55%, white)` }}>
          +{scheduled}
        </span>
      )}
      <span className="text-muted">/{need}</span>
    </span>
  );
}

export function DoneLegend({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center gap-4 text-xs text-muted", className)}>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-3.5 rounded-full bg-ink-2" /> Done
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-3.5 rounded-full bg-ink-2/30" /> Signed up, not done yet
      </span>
    </div>
  );
}

const ROWS = [
  { key: "tour", label: "Tours", color: "var(--color-tour)" },
  { key: "event", label: "Events", color: "var(--color-event)" },
  { key: "hs_visit", label: "High school visits", color: "var(--color-hs)" },
  { key: "hs_visit_ac", label: "Of those, with an AC", color: "var(--color-hs)", sub: true },
] as const;

export function ProgressCard({
  tally,
  reqs,
  status,
  title,
  className,
  onPick,
}: {
  tally: Tally;
  reqs: Reqs;
  status: Status;
  title: string;
  className?: string;
  /** Calendar: tap a row to show only that kind of item */
  onPick?: (type: "tour" | "event" | "hs_visit") => void;
}) {
  return (
    <div className={cx("rounded-2xl border border-line bg-white p-5 shadow-soft", className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="font-semibold text-ink">{title}</p>
        <StatusPill status={status} />
      </div>
      <div className="space-y-3.5">
        {ROWS.map((r) => {
          const t = tally[r.key];
          const need = reqs[r.key];
          const pickType = r.key === "hs_visit_ac" ? "hs_visit" : r.key;
          const body = (
            <>
              <div className="mb-1.5 flex items-baseline justify-between text-[14px]">
                <span className={cx("sub" in r && r.sub ? "text-muted" : "font-medium text-ink-2", onPick && "group-hover:text-brand")}>{r.label}</span>
                <DoneCount done={t.done} scheduled={t.scheduled} need={need} color={r.color} />
              </div>
              <Bar value={t.done} soft={t.scheduled} max={need} color={r.color} />
            </>
          );
          return onPick ? (
            <button
              key={r.key}
              onClick={() => onPick(pickType)}
              className={cx("group -mx-2 block w-[calc(100%+1rem)] rounded-xl px-2 py-1 text-left hover:bg-canvas", "sub" in r && r.sub && "ml-1 w-[calc(100%+0.25rem)] border-l-2 border-line pl-3")}
            >
              {body}
            </button>
          ) : (
            <div key={r.key} className={cx("sub" in r && r.sub && "ml-1 border-l-2 border-line pl-3")}>
              {body}
            </div>
          );
        })}
      </div>
      <NeedsLine tally={tally} reqs={reqs} status={status} className="mt-4 rounded-xl bg-canvas px-3 py-2.5" />
      <DoneLegend className="mt-3" />
    </div>
  );
}

/** One-line version for phones */
export function ProgressStrip({
  tally,
  reqs,
  status,
  onPick,
}: {
  tally: Tally;
  reqs: Reqs;
  status: Status;
  onPick?: (type: "tour" | "event" | "hs_visit") => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3 shadow-soft">
      <div className="grid grid-cols-4 gap-2">
        {ROWS.map((r) => {
          const t = tally[r.key];
          return (
            <button
              key={r.key}
              type="button"
              disabled={!onPick}
              onClick={() => onPick?.(r.key === "hs_visit_ac" ? "hs_visit" : r.key)}
              className="min-w-0 rounded-xl py-1 text-center enabled:active:bg-canvas"
            >
              <p className="text-[15px]">
                <DoneCount done={t.done} scheduled={t.scheduled} need={reqs[r.key]} color={r.color} />
              </p>
              <p className="truncate text-[11px] text-muted">{r.key === "hs_visit" ? "HS visits" : r.key === "hs_visit_ac" ? "Of those, AC" : r.label}</p>
              <div className="mt-1.5">
                <Bar value={t.done} soft={t.scheduled} max={reqs[r.key]} color={r.color} />
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-2.5">
        <NeedsLine tally={tally} reqs={reqs} status={status} />
        <StatusPill status={status} />
      </div>
    </div>
  );
}
