"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { dropSignup, markNoShow } from "@/app/actions/signups";
import { useSignupActions } from "@/components/calendar/event-panel";
import { typeMeta } from "@/components/calendar/shared";
import { Button, cx } from "@/components/ui";
import { dateShort, timeRange } from "@/lib/dates";

type Shift = {
  id: string;
  title: string;
  type: "tour" | "event" | "hs_visit" | "calendar";
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  withAc: boolean;
  noShow: boolean;
};

/** canMark = the person's manager or an admin, looking at a shift that already happened */
export function ShiftRow({ shift, canDrop, canMark }: { shift: Shift; canDrop?: boolean; canMark?: { userId: string } }) {
  const meta = typeMeta(shift.type);
  const [confirm, setConfirm] = useState(false);
  const { pendingId, run } = useSignupActions();
  const [weekday, monthDay] = dateShort(shift.startsAt).split(", ");
  const [month, day] = monthDay.split(" ");

  return (
    <div className="group flex items-center gap-4 px-4 py-3.5 sm:px-5">
      <div className="flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5" style={{ background: `color-mix(in srgb, ${meta.color} 10%, white)` }}>
        <span className="text-[11px] font-medium uppercase" style={{ color: meta.color }}>
          {month}
        </span>
        <span className="text-lg leading-tight font-semibold text-ink tabular-nums">{day}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className={cx("truncate text-[15px] font-semibold", shift.noShow ? "text-muted line-through" : "text-ink")}>{shift.title}</p>
        <p className="truncate text-[13px] text-muted">
          {weekday} · {timeRange(shift.startsAt, shift.endsAt, shift.allDay)} · {meta.short}
          {shift.withAc && <span className="font-medium text-hs"> · With AC</span>}
        </p>
        {shift.location && shift.location !== shift.title && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-muted">
            <MapPin size={12} /> {shift.location}
          </p>
        )}
      </div>
      {shift.noShow && <span className="text-sm text-bad">No-show</span>}
      {canMark && (
        <Button
          variant="ghost"
          size="sm"
          className={cx(!shift.noShow && "md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100")}
          disabled={pendingId !== null}
          onClick={() => run(shift.id, () => markNoShow(shift.id, canMark.userId, !shift.noShow))}
        >
          {shift.noShow ? "Undo" : "No-show"}
        </Button>
      )}
      {canDrop &&
        (confirm ? (
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
              Keep
            </Button>
            <Button variant="danger" size="sm" disabled={pendingId !== null} onClick={() => run(shift.id, () => dropSignup(shift.id))}>
              Drop
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
            Drop
          </Button>
        ))}
    </div>
  );
}
