"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { CalendarPlus, Check, Clock, MapPin, Pencil, UserPlus, X } from "lucide-react";
import { addEventLinks } from "@/lib/calendar-links";
import { adminAddPerson, adminRemovePerson, adminSetNoShow, dropSignup, signUp, type ActionResult } from "@/app/actions/signups";
import { dateLong, timeRange } from "@/lib/dates";
import { Avatar, Button, cx } from "../ui";
import { useToast } from "../toast";
import { filled, isMine, isPast, spotsLeft, takesSignups, typeMeta, type CalEvent } from "./shared";

export function useSignupActions() {
  const toast = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();
  const run = (id: string, fn: () => Promise<ActionResult>, onDone?: () => void) => {
    setPendingId(id);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) toast(r.message ?? "Saved");
        else toast(r.error, "error");
      } catch {
        toast("Something went wrong. Try again.", "error");
      } finally {
        setPendingId(null);
        onDone?.();
      }
    });
  };
  return { pendingId, run };
}

export function EventPanel({
  event,
  me,
  isAdmin,
  now,
  everyone,
  onClose,
}: {
  event: CalEvent;
  me: string;
  isAdmin: boolean;
  now: number;
  everyone: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { pendingId, run } = useSignupActions();
  const meta = typeMeta(event.type);
  const mine = isMine(event, me);
  const past = isPast(event, now);
  const left = spotsLeft(event);
  const busy = pendingId !== null;
  const [confirmDrop, setConfirmDrop] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={event.title}>
      <button className="anim-fade absolute inset-0 bg-ink/25" onClick={onClose} aria-label="Close" />
      <div
        className={cx(
          "thin-scroll absolute flex flex-col overflow-y-auto bg-white shadow-pop",
          "anim-sheet inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl",
          "md:anim-panel md:inset-y-3 md:right-3 md:left-auto md:max-h-none md:w-[440px] md:rounded-3xl",
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white/95 px-6 pt-5 pb-2 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium"
              style={{ background: `color-mix(in srgb, ${meta.color} 12%, white)`, color: meta.color }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
              {meta.short}
            </span>
            {event.withAc && (
              <span className="inline-flex h-7 items-center rounded-full bg-[#e2f5f1] px-3 text-[13px] font-medium text-hs">With AC</span>
            )}
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-canvas hover:text-ink" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 pb-6">
          <h2 className="font-display mt-1 text-[34px] leading-[1.05] text-ink">{event.title}</h2>

          <div className="mt-4 space-y-2.5 text-[15px] text-ink-2">
            <p className="flex items-start gap-2.5">
              <Clock size={18} className="mt-0.5 shrink-0 text-muted" />
              <span>
                {dateLong(event.startsAt)}
                <br />
                <span className="text-muted">{timeRange(event.startsAt, event.endsAt, event.allDay)}</span>
              </span>
            </p>
            {event.location && (
              <p className="flex items-start gap-2.5">
                <MapPin size={18} className="mt-0.5 shrink-0 text-muted" />
                {event.location}
              </p>
            )}
          </div>

          {event.notes && <p className="mt-4 rounded-2xl bg-canvas px-4 py-3 text-[15px] whitespace-pre-line text-ink-2">{event.notes}</p>}

          {/* Main action */}
          {takesSignups(event) && (
            <div className="mt-6">
              {mine ? (
                confirmDrop ? (
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-[15px] font-medium text-ink">Drop this shift?</p>
                    <Button variant="ghost" size="lg" className="h-12 px-5" onClick={() => setConfirmDrop(false)}>
                      Keep
                    </Button>
                    <Button
                      variant="danger"
                      size="lg"
                      className="h-12 px-5"
                      disabled={busy}
                      onClick={() => run(event.id, () => dropSignup(event.id), () => setConfirmDrop(false))}
                    >
                      Drop
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-good-soft font-medium text-good">
                      <Check size={18} strokeWidth={2.5} /> {past ? "You were there" : "You're signed up"}
                    </div>
                    {!past && (
                      <Button variant="outline" size="lg" className="h-12 px-5" disabled={busy} onClick={() => setConfirmDrop(true)}>
                        Drop
                      </Button>
                    )}
                  </div>
                )
              ) : past ? (
                <p className="text-center text-sm text-muted">This already happened.</p>
              ) : left > 0 ? (
                <>
                  <Button size="lg" className="h-12 w-full" disabled={busy} onClick={() => run(event.id, () => signUp(event.id))}>
                    {busy ? "Signing up…" : "Sign up"}
                  </Button>
                  <p className="mt-2 text-center text-sm text-muted">
                    {left} {left === 1 ? "spot" : "spots"} left
                  </p>
                </>
              ) : (
                <div className="flex h-12 items-center justify-center rounded-xl bg-canvas font-medium text-muted">Full</div>
              )}
            </div>
          )}

          {mine && !past && <AddToCalendar event={event} />}

          {/* Who's going */}
          {takesSignups(event) && (
            <div className="mt-7">
              <div className="mb-3 flex items-baseline justify-between">
                <p className="font-semibold text-ink">Who&apos;s going</p>
                <p className="text-sm text-muted tabular-nums">
                  {filled(event)} of {event.spots} spots
                </p>
              </div>
              <ul className="space-y-1">
                {event.people.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                    <Avatar name={p.name} size={30} />
                    <span className={cx("flex-1 text-[15px]", p.status === "no_show" ? "text-muted line-through" : "text-ink")}>
                      {p.name}
                      {p.id === me && <span className="text-muted"> (you)</span>}
                    </span>
                    {isAdmin && (
                      <span className="flex items-center gap-1">
                        {past && (
                          <button
                            className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-canvas hover:text-ink"
                            disabled={busy}
                            onClick={() => run(event.id, () => adminSetNoShow(event.id, p.id, p.status !== "no_show"))}
                          >
                            {p.status === "no_show" ? "Undo no-show" : "No-show"}
                          </button>
                        )}
                        <button
                          className="rounded-lg p-1.5 text-muted hover:bg-bad-soft hover:text-bad"
                          aria-label={`Remove ${p.name}`}
                          disabled={busy}
                          onClick={() => run(event.id, () => adminRemovePerson(event.id, p.id))}
                        >
                          <X size={15} />
                        </button>
                      </span>
                    )}
                  </li>
                ))}
                {Array.from({ length: past ? 0 : left }).map((_, i) => (
                  <li key={i} className="flex items-center gap-3 px-1 py-1.5 text-[15px] text-faint">
                    <span className="h-[30px] w-[30px] rounded-full border border-dashed border-line" />
                    Open spot
                  </li>
                ))}
              </ul>
              {isAdmin && <AddPerson event={event} everyone={everyone} busy={busy} run={run} />}
            </div>
          )}

          {!takesSignups(event) && event.source === "outlook" && <p className="mt-6 text-sm text-muted">From the Outlook calendar</p>}

          {isAdmin && (
            <Link href={`/admin/events/${event.id}`} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline">
              <Pencil size={14} /> Edit
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function AddPerson({
  event,
  everyone,
  busy,
  run,
}: {
  event: CalEvent;
  everyone: { id: string; name: string }[];
  busy: boolean;
  run: (id: string, fn: () => Promise<ActionResult>, onDone?: () => void) => void;
}) {
  const [value, setValue] = useState("");
  const options = everyone.filter((p) => !event.people.some((x) => x.id === p.id));
  return (
    <div className="mt-3 flex gap-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm text-ink"
        aria-label="Add a person"
      >
        <option value="">Add someone…</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <Button
        variant="secondary"
        size="sm"
        className="h-10"
        disabled={!value || busy}
        onClick={() => {
          run(event.id, () => adminAddPerson(event.id, value));
          setValue("");
        }}
      >
        <UserPlus size={16} /> Add
      </Button>
    </div>
  );
}

/** Puts this one event in their calendar right away (the subscription can take hours to catch up) */
function AddToCalendar({ event }: { event: CalEvent }) {
  const [base, setBase] = useState("");
  useEffect(() => setBase(window.location.origin), []);
  if (!base) return null;
  const links = addEventLinks(base, event);
  const cls = "flex h-10 items-center justify-center rounded-xl border border-line text-sm font-medium text-ink-2 hover:bg-canvas";
  return (
    <div className="mt-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm text-muted">
        <CalendarPlus size={15} /> Add to my calendar
      </p>
      <div className="grid grid-cols-3 gap-2">
        <a href={links.outlook} target="_blank" rel="noreferrer" className={cls}>
          Outlook
        </a>
        <a href={links.google} target="_blank" rel="noreferrer" className={cls}>
          Google
        </a>
        <a href={links.apple} className={cls}>
          Apple
        </a>
      </div>
    </div>
  );
}
