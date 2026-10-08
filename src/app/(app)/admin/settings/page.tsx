import { requireRole } from "@/lib/auth";
import type { Metadata } from "next";
import { getSemester, getSetting } from "@/lib/data";
import { emailEnabled } from "@/lib/email";
import { SettingsForms } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole("admin");
  const semester = await getSemester();
  const [outlookUrl, autoShift, autoNudge, lastSyncRaw] = await Promise.all([
    getSetting("outlook_ics_url"),
    getSetting("auto_shift_reminders", "true"),
    getSetting("auto_weekly_nudges", "false"),
    getSetting("outlook_last_sync"),
  ]);
  let lastSync: { at: string; ok: boolean; message: string } | null = null;
  try {
    lastSync = lastSyncRaw ? JSON.parse(lastSyncRaw) : null;
  } catch {}

  return (
    <SettingsForms
      semester={{
        name: semester.name,
        startsOn: semester.startsOn,
        endsOn: semester.endsOn,
        reqTours: semester.reqTours,
        reqEvents: semester.reqEvents,
        reqHsVisits: semester.reqHsVisits,
        reqHsVisitsAc: semester.reqHsVisitsAc,
      }}
      outlookUrl={outlookUrl}
      autoShift={autoShift === "true"}
      autoNudge={autoNudge === "true"}
      lastSync={lastSync}
      emailOn={emailEnabled}
    />
  );
}
