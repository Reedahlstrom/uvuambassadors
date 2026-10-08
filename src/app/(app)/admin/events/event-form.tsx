"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { deleteEvent, saveEvent, type FormState } from "@/app/actions/admin";
import { TYPES } from "@/components/calendar/shared";
import { Button, Card, Field, cx, inputClass } from "@/components/ui";

type Initial = {
  id: string;
  type: "tour" | "event" | "hs_visit" | "calendar";
  title: string;
  date: string;
  start: string;
  end: string;
  location: string;
  notes: string;
  spots: number | null;
  withAc: boolean;
  allDay: boolean;
  inSeries: boolean;
};

const DEFAULTS: Record<Initial["type"], { title: string; spots: string; start: string; end: string }> = {
  tour: { title: "Campus tour", spots: "2", start: "10:00", end: "11:00" },
  event: { title: "", spots: "6", start: "18:00", end: "20:00" },
  hs_visit: { title: "", spots: "2", start: "08:30", end: "11:00" },
  calendar: { title: "", spots: "", start: "17:00", end: "18:00" },
};

export function EventForm({ initial, today }: { initial?: Initial; today: string }) {
  const [state, action, saving] = useActionState<FormState, FormData>(saveEvent, {});
  const [type, setType] = useState<Initial["type"]>(initial?.type ?? "tour");
  const [title, setTitle] = useState(initial?.title ?? DEFAULTS.tour.title);
  const [spots, setSpots] = useState(initial ? (initial.spots?.toString() ?? "") : DEFAULTS.tour.spots);
  const [start, setStart] = useState(initial?.start ?? DEFAULTS.tour.start);
  const [end, setEnd] = useState(initial?.end ?? DEFAULTS.tour.end);
  const [allDay, setAllDay] = useState(initial?.allDay ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();

  const pickType = (t: Initial["type"]) => {
    setType(t);
    if (!initial) {
      const d = DEFAULTS[t];
      setTitle((cur) => (cur === "" || Object.values(DEFAULTS).some((x) => x.title === cur) ? d.title : cur));
      setSpots(d.spots);
      setStart(d.start);
      setEnd(d.end);
    }
  };

  return (
    <Card className="mx-auto max-w-[640px] p-6 sm:p-8">
      <h1 className="font-display mb-6 text-[34px] leading-none text-ink">{initial ? "Edit" : "New"}</h1>
      <form action={action} className="space-y-5">
        {initial && <input type="hidden" name="id" value={initial.id} />}
        <input type="hidden" name="type" value={type} />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => pickType(t.key)}
              className={cx(
                "flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors",
                type === t.key ? "border-transparent text-white" : "border-line bg-white text-ink-2 hover:bg-canvas",
              )}
              style={type === t.key ? { background: t.color } : undefined}
            >
              {t.short === "Outlook" ? "Info only" : t.short}
            </button>
          ))}
        </div>

        <Field label="Title">
          <input
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder={type === "hs_visit" ? "Orem High" : "Preview Day"}
            required
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Date">
            <input type="date" name="date" defaultValue={initial?.date ?? today} className={inputClass} required />
          </Field>
          {!allDay && (
            <>
              <Field label="Start">
                <input type="time" name="start" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} required />
              </Field>
              <Field label="End">
                <input type="time" name="end" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} required />
              </Field>
            </>
          )}
        </div>
        <label className="-mt-2 flex w-fit cursor-pointer items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" name="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
          All day
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Location">
            <input name="location" defaultValue={initial?.location} className={inputClass} placeholder="Welcome Center" />
          </Field>
          <Field label="Spots" hint={type === "calendar" ? "Empty = no sign-up" : undefined}>
            <input
              name="spots"
              type="number"
              min={1}
              max={500}
              value={spots}
              onChange={(e) => setSpots(e.target.value)}
              className={inputClass}
              required={type !== "calendar"}
            />
          </Field>
        </div>

        {type === "hs_visit" && (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3">
            <input type="checkbox" name="withAc" defaultChecked={initial?.withAc} className="h-5 w-5 accent-[var(--color-hs)]" />
            <span className="text-[15px] font-medium text-ink">With an admissions counselor (AC)</span>
          </label>
        )}

        <Field label="Notes">
          <textarea name="notes" defaultValue={initial?.notes} rows={3} className={inputClass + " h-auto py-2.5"} placeholder="Meet at the Welcome Center at 8:00" />
        </Field>

        {!initial && (
          <Field label="Repeat every week until" hint="Leave empty for a one-time item">
            <input type="date" name="repeatUntil" className={inputClass + " sm:w-60"} min={today} />
          </Field>
        )}

        {state.error && <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">{state.error}</p>}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Link href="/admin/events" className="px-4 py-2 text-[15px] text-muted hover:text-ink">
            Cancel
          </Link>
          {initial && (
            <div className="ml-auto flex gap-2">
              {confirmDelete ? (
                <>
                  <Button type="button" variant="danger" disabled={deleting} onClick={() => startDelete(() => deleteEvent(initial.id))}>
                    {initial.inSeries ? "Just this one" : "Yes, delete"}
                  </Button>
                  {initial.inSeries && (
                    <Button type="button" variant="danger" disabled={deleting} onClick={() => startDelete(() => deleteEvent(initial.id, true))}>
                      This and later
                    </Button>
                  )}
                </>
              ) : (
                <Button type="button" variant="ghost" className="text-bad" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </form>
    </Card>
  );
}
