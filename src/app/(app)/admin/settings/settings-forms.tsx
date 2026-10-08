"use client";

import { useActionState, useTransition, useState } from "react";
import { RefreshCw } from "lucide-react";
import { saveIntegrations, saveSemester, syncOutlookNow, type FormState } from "@/app/actions/admin";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { TIMEZONE } from "@/lib/config";

type Sem = {
  name: string;
  startsOn: string;
  endsOn: string;
  reqTours: number;
  reqEvents: number;
  reqHsVisits: number;
  reqHsVisitsAc: number;
};

function Msg({ s }: { s: FormState }) {
  if (s.error) return <p className="text-sm text-bad">{s.error}</p>;
  if (s.ok) return <p className="text-sm text-good">{s.ok}</p>;
  return null;
}

export function SettingsForms({
  semester,
  outlookUrl,
  autoShift,
  autoNudge,
  lastSync,
  emailOn,
}: {
  semester: Sem;
  outlookUrl: string;
  autoShift: boolean;
  autoNudge: boolean;
  lastSync: { at: string; ok: boolean; message: string } | null;
  emailOn: boolean;
}) {
  const [semState, semAction, semPending] = useActionState<FormState, FormData>(saveSemester, {});
  const [intState, intAction, intPending] = useActionState<FormState, FormData>(saveIntegrations, {});
  const [syncState, setSyncState] = useState<FormState>({});
  const [syncing, startSync] = useTransition();

  return (
    <div className="mx-auto max-w-[720px] space-y-6">
      <Card className="p-6 sm:p-8">
        <h2 className="font-display mb-5 text-[30px] leading-none text-ink">Semester</h2>
        <form action={semAction} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name">
              <input name="name" defaultValue={semester.name} className={inputClass} required />
            </Field>
            <Field label="Starts">
              <input type="date" name="startsOn" defaultValue={semester.startsOn} className={inputClass} required />
            </Field>
            <Field label="Ends">
              <input type="date" name="endsOn" defaultValue={semester.endsOn} className={inputClass} required />
            </Field>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink-2">Each ambassador needs</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["reqTours", "Tours"],
                  ["reqEvents", "Events"],
                  ["reqHsVisits", "HS visits"],
                  ["reqHsVisitsAc", "…with an AC"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="rounded-xl border border-line px-3 py-2.5">
                  <span className="block text-xs text-muted">{label}</span>
                  <input
                    type="number"
                    name={k}
                    min={0}
                    max={100}
                    defaultValue={semester[k]}
                    className="w-full bg-transparent text-xl font-semibold text-ink tabular-nums outline-none"
                  />
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2.5 text-[15px] text-ink-2">
            <input type="checkbox" name="asNew" className="h-4 w-4 accent-[var(--color-brand)]" />
            Start a new semester (keeps last semester&apos;s history)
          </label>
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={semPending}>
              {semPending ? "Saving…" : "Save"}
            </Button>
            <Msg s={semState} />
          </div>
        </form>
      </Card>

      <Card className="p-6 sm:p-8">
        <h2 className="font-display mb-5 text-[30px] leading-none text-ink">Outlook calendar</h2>
        <form action={intAction} className="space-y-5">
          <Field label="Published calendar link (ICS)" hint="Outlook → Settings → Calendar → Shared calendars → Publish a calendar → ICS link">
            <input name="outlookUrl" defaultValue={outlookUrl} className={inputClass} placeholder="https://outlook.office365.com/owa/calendar/…/calendar.ics" />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={syncing || !outlookUrl}
              onClick={() => startSync(async () => setSyncState(await syncOutlookNow()))}
            >
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} /> Sync now
            </Button>
            {syncState.ok || syncState.error ? (
              <Msg s={syncState} />
            ) : (
              lastSync && (
                <p className={`text-sm ${lastSync.ok ? "text-muted" : "text-bad"}`}>
                  {lastSync.message} {new Date(lastSync.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: TIMEZONE })}
                </p>
              )
            )}
          </div>

          <div className="border-t border-line pt-5">
            <h3 className="mb-3 font-semibold text-ink">Automatic emails</h3>
            {!emailOn && <p className="mb-3 rounded-xl bg-warn-soft px-3.5 py-2.5 text-sm text-warn">Email isn&apos;t connected yet (RESEND_API_KEY).</p>}
            <label className="flex items-start gap-3 py-2">
              <input type="checkbox" name="autoShift" defaultChecked={autoShift} className="mt-1 h-4 w-4 accent-[var(--color-brand)]" />
              <span>
                <span className="block text-[15px] font-medium text-ink">Day-before shift reminders</span>
                <span className="text-sm text-muted">Everyone gets a heads-up the day before what they signed up for.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 py-2">
              <input type="checkbox" name="autoNudge" defaultChecked={autoNudge} className="mt-1 h-4 w-4 accent-[var(--color-brand)]" />
              <span>
                <span className="block text-[15px] font-medium text-ink">Monday nudge to anyone behind</span>
                <span className="text-sm text-muted">Tells them exactly what they still need, with a link to open spots.</span>
              </span>
            </label>
          </div>

          <div className="flex items-center gap-4">
            <Button type="submit" disabled={intPending}>
              {intPending ? "Saving…" : "Save"}
            </Button>
            <Msg s={intState} />
          </div>
        </form>
      </Card>
    </div>
  );
}
