"use server";

import { eq, inArray } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { sendEmails } from "@/lib/email";
import { buildNudges } from "@/lib/nudges";

export type ReminderResult = { ok: true; sent: number; skipped: number } | { ok: false; error: string };

export async function sendReminders(userIds: string[], note: string): Promise<ReminderResult> {
  const me = await requireRole("manager", "admin");
  if (userIds.length === 0) return { ok: false, error: "Pick at least one person." };

  // Managers can only email their own team
  if (me.role === "manager") {
    const db = await getDb();
    const myTeams = await db.select({ id: schema.teams.id }).from(schema.teams).where(eq(schema.teams.managerId, me.id));
    const teamIds = myTeams.map((t) => t.id);
    const allowed = teamIds.length
      ? await db.select({ id: schema.users.id }).from(schema.users).where(inArray(schema.users.teamId, teamIds))
      : [];
    const ok = new Set(allowed.map((a) => a.id));
    if (userIds.some((id) => !ok.has(id))) return { ok: false, error: "You can only remind people on your team." };
  }

  const { mails, skipped } = await buildNudges(userIds, note.slice(0, 1000), me.id);
  const sent = await sendEmails(mails);
  return { ok: true, sent, skipped };
}
