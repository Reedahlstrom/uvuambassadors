import { requireRole } from "@/lib/auth";
import { getProgress, getSemester, reqsOf } from "@/lib/data";
import { dayKey } from "@/lib/dates";
import { REQ_KEYS, REQ_LABEL, STATUS_LABEL } from "@/lib/progress";

/** Admin: everyone's progress as a spreadsheet (done and signed up are separate columns). */
export async function GET() {
  await requireRole("admin");
  const semester = await getSemester();
  const reqs = reqsOf(semester);
  const people = await getProgress();

  const cell = (v: string | number) => {
    let s = String(v);
    // Stop spreadsheets from running text that starts like a formula
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    "Name",
    "Email",
    "Team",
    "Status",
    ...REQ_KEYS.flatMap((k) => {
      const l = k === "hs_visit_ac" ? "HS visits with AC (part of HS visits)" : REQ_LABEL[k];
      return [`${l} done`, `${l} signed up`, `${l} needed`];
    }),
    "Next shift",
  ];
  const rows = people.map((p) => [
    p.name,
    p.email,
    p.teamName ?? "",
    STATUS_LABEL[p.status],
    ...REQ_KEYS.flatMap((k) => [p.tally[k].done, p.tally[k].scheduled, reqs[k]]),
    p.next ? `${p.next.title} ${dayKey(p.next.startsAt)}` : "",
  ]);
  const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");
  const name = `ambassadors-${semester.name.toLowerCase().replace(/\s+/g, "-")}.csv`;
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"` },
  });
}
