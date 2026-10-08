"use server";

import { eq, inArray } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { sendEmails } from "@/lib/email";
import { buildNudges } from "@/lib/nudges";
import { PLACEHOLDER_EMAIL_DOMAIN } from "@/lib/config";

export type ReminderResult = { ok: true; sent: number; skipped: number } | { ok: false; error: string };

export async function sendReminders(userIds: string[], note: string, custom?: { subject: string; body: string }): Promise<ReminderResult> {
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

  const message = custom
    ? {
        subject: custom.subject.trim().slice(0, 150) || "Quick reminder",
        body: custom.body.trim().slice(0, 4000),
        // Replies go straight to the manager
        replyTo: me.email.endsWith(PLACEHOLDER_EMAIL_DOMAIN) ? undefined : me.email,
      }
    : undefined;
  if (message && !message.body) return { ok: false, error: "Write a message first." };
  const { mails, skipped } = await buildNudges(userIds, note.slice(0, 1000), me.id, message);
  const sent = await sendEmails(mails);
  return { ok: true, sent, skipped };
}
