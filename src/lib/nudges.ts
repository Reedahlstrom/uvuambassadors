import "server-only";
import { getProgress, getSemester, reqsOf } from "./data";
import type { Mail } from "./email";
import { needsSentence } from "./progress";
import { baseUrl } from "./url";

/** Build one personalized "here's what you still need" email per person. */
export async function buildNudges(userIds: string[], note: string, sentById?: string): Promise<{ mails: Mail[]; skipped: number }> {
  const semester = await getSemester();
  const reqs = reqsOf(semester);
  const people = await getProgress({ userIds });
  const link = `${await baseUrl()}/signup`;
  const mails: Mail[] = [];
  let skipped = 0;
  for (const p of people) {
    const needs = needsSentence(p.tally, reqs);
    if (!needs) {
      skipped++;
      continue;
    }
    const first = p.name.split(" ")[0];
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

