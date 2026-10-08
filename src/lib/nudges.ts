import "server-only";
import { getProgress, getSemester, reqsOf } from "./data";
import type { Mail } from "./email";
import { needsSentence } from "./progress";
import { baseUrl } from "./url";

/** Build one personalized "here's what you still need" email per person. */
/** A manager's own message. {name} and {needs} are filled in per person. */
export type CustomReminder = { subject: string; body: string; replyTo?: string };

export const fillReminder = (text: string, first: string, needs: string) =>
  text.replace(/\{name\}/g, first).replace(/\{needs\}/g, needs || "everything you need");

export async function buildNudges(
  userIds: string[],
  note: string,
  sentById?: string,
  custom?: CustomReminder,
): Promise<{ mails: Mail[]; skipped: number }> {
  const semester = await getSemester();
  const reqs = reqsOf(semester);
  const people = await getProgress({ userIds });
  const link = `${await baseUrl()}/signup`;
  const mails: Mail[] = [];
  let skipped = 0;
  for (const p of people) {
    const needs = needsSentence(p.tally, reqs);
    const first = p.name.split(" ")[0];
    if (custom) {
      // Skip people who are done only when the message is about what they still need
      if (!needs && custom.body.includes("{needs}")) {
        skipped++;
        continue;
      }
      mails.push({
        to: p.email,
        toUserId: p.id,
        sentById,
        replyTo: custom.replyTo,
        kind: "reminder",
        subject: fillReminder(custom.subject, first, needs),
        heading: fillReminder(custom.subject, first, needs),
        lines: fillReminder(custom.body, first, needs)
          .split(/\n\s*\n/)
          .map((l) => l.trim())
          .filter(Boolean),
        button: { label: "See open spots", url: link },
      });
      continue;
    }
    if (!needs) {
      skipped++;
      continue;
    }
    mails.push({
      to: p.email,
      toUserId: p.id,
      sentById,
      kind: sentById ? "reminder" : "nudge",
      subject: "Time to sign up for your ambassador shifts",
      heading: `Hi ${first},`,
      lines: [`You still need ${needs} this semester.`, ...(note.trim() ? [note.trim()] : [])],
      button: { label: "See open spots", url: link },
    });
  }
  return { mails, skipped };
}

