import { Bar, StatusPill, cx } from "./ui";
import type { Reqs, Status, Tally } from "@/lib/progress";

const ROWS = [
  { key: "tour", label: "Tours", color: "var(--color-tour)" },
  { key: "event", label: "Events", color: "var(--color-event)" },
  { key: "hs_visit", label: "High school visits", color: "var(--color-hs)" },
  { key: "hs_visit_ac", label: "With an AC", color: "var(--color-hs)", sub: true },
] as const;

export function ProgressCard({
  tally,
  reqs,
  status,
  title,
  className,
}: {
  tally: Tally;
  reqs: Reqs;
  status: Status;
  title: string;
  className?: string;
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
          const have = t.done + t.scheduled;
          const need = reqs[r.key];
          return (
            <div key={r.key} className={cx("sub" in r && r.sub && "pl-4")}>
              <div className="mb-1.5 flex items-baseline justify-between text-[14px]">
                <span className={cx("sub" in r && r.sub ? "text-muted" : "font-medium text-ink-2")}>{r.label}</span>
                <span className="tabular-nums text-ink">
                  <b className="font-semibold">{Math.min(have, 99)}</b>
                  <span className="text-muted">/{need}</span>
                </span>
              </div>
              <Bar value={t.done} soft={t.scheduled} max={need} color={r.color} />
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3.5 rounded-full bg-ink-2" /> Done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3.5 rounded-full bg-ink-2/30" /> Signed up
        </span>
      </div>
    </div>
  );
}

/** One-line version for phones */
export function ProgressStrip({ tally, reqs, status }: { tally: Tally; reqs: Reqs; status: Status }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3 shadow-soft">
      <div className="grid grid-cols-4 gap-2">
        {ROWS.map((r) => {
          const t = tally[r.key];
          return (
            <div key={r.key} className="min-w-0 text-center">
              <p className="tabular-nums text-[17px] font-semibold text-ink">
                {t.done + t.scheduled}
                <span className="text-sm font-normal text-muted">/{reqs[r.key]}</span>
              </p>
              <p className="truncate text-[11px] text-muted">{r.key === "hs_visit" ? "HS visits" : r.key === "hs_visit_ac" ? "With AC" : r.label}</p>
              <div className="mt-1.5">
                <Bar value={t.done} soft={t.scheduled} max={reqs[r.key]} color={r.color} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 flex justify-center">
        <StatusPill status={status} />
      </div>
    </div>
  );
}
