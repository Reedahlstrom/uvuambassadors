import { requireRole } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, desc, eq, gte, lt, type SQL } from "drizzle-orm";
import { Plus, Upload } from "lucide-react";
import { ButtonLink, Card, Dot, cx } from "@/components/ui";
import { TYPE_META } from "@/lib/config";
import { getDb, schema } from "@/lib/db";
import { dateShort, dayKey, timeRange } from "@/lib/dates";

export const metadata: Metadata = { title: "Events" };

const TYPES = ["tour", "event", "hs_visit", "calendar"] as const;

export default async function AdminEvents({ searchParams }: { searchParams: Promise<{ when?: string; type?: string }> }) {
  await requireRole("admin");
  const sp = await searchParams;
  const past = sp.when === "past";
  const type = TYPES.find((t) => t === sp.type);
  const now = new Date();
  const db = await getDb();

  const conds: SQL[] = [past ? lt(schema.events.startsAt, now) : gte(schema.events.startsAt, now)];
  if (type) conds.push(eq(schema.events.type, type));
  const rows = await db
    .select({ event: schema.events, filled: count(schema.signups.id) })
    .from(schema.events)
    .leftJoin(schema.signups, eq(schema.signups.eventId, schema.events.id))
    .where(and(...conds))
    .groupBy(schema.events.id)
    .orderBy(past ? desc(schema.events.startsAt) : asc(schema.events.startsAt))
    .limit(300);

  const link = (p: { when?: string; type?: string }) => {
    const q = new URLSearchParams();
    const w = p.when ?? sp.when;
    const t = "type" in p ? p.type : sp.type;
    if (w) q.set("when", w);
    if (t) q.set("type", t);
    const s = q.toString();
    return `/admin/events${s ? `?${s}` : ""}`;
  };
  const pill = (active: boolean) =>
    cx(
      "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium",
      active ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-2 hover:bg-canvas",
    );

  let lastDay = "";
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={link({ when: "" })} className={pill(!past)}>
          Upcoming
        </Link>
        <Link href={link({ when: "past" })} className={pill(past)}>
          Past
        </Link>
        <span className="mx-1 h-6 w-px bg-line" />
        <Link href={link({ type: undefined })} className={pill(!type)}>
          All
        </Link>
        {TYPES.map((t) => (
          <Link key={t} href={link({ type: t })} className={pill(type === t)}>
            <Dot color={TYPE_META[t].color} />
            {TYPE_META[t].label}
          </Link>
        ))}
        <div className="ml-auto flex gap-2">
          <ButtonLink href="/admin/events/import" variant="secondary" size="sm">
            <Upload size={15} /> Import
          </ButtonLink>
          <ButtonLink href="/admin/events/new" size="sm">
            <Plus size={16} /> New
          </ButtonLink>
        </div>
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 && <p className="py-14 text-center text-muted">Nothing here yet.</p>}
        <div className="divide-y divide-line">
          {rows.map(({ event: e, filled }) => {
            const d = dayKey(e.startsAt);
            const showDay = d !== lastDay;
            lastDay = d;
            const short = e.spots != null && filled < e.spots;
            return (
              <div key={e.id}>
                {showDay && <p className="bg-canvas/70 px-5 py-2 text-[13px] font-semibold text-ink-2">{dateShort(e.startsAt)}</p>}
                <Link href={`/admin/events/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60 sm:gap-4 sm:px-5">
                  <Dot color={TYPE_META[e.type].color} size={10} />
                  {/* Phone: title on top, time underneath. Wider: time column, then title. */}
                  <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-4">
                    <span className="order-2 text-[13px] text-muted tabular-nums sm:order-1 sm:w-[130px] sm:shrink-0 sm:text-sm">
                      {timeRange(e.startsAt, e.endsAt, e.allDay)}
                    </span>
                    <span className="order-1 min-w-0 truncate text-[15px] font-medium text-ink sm:order-2 sm:flex-1">
                      {e.title}
                      {e.withAc && <span className="ml-2 text-sm font-normal text-hs">With AC</span>}
                    </span>
                  </span>
                  {e.spots != null ? (
                    <span
                      className={cx(
                        "rounded-full px-2.5 py-1 text-[13px] font-medium tabular-nums",
                        short && !past ? "bg-warn-soft text-warn" : "bg-good-soft text-good",
                      )}
                    >
                      {filled}/{e.spots}
                    </span>
                  ) : (
                    <span className="text-[13px] text-faint">{e.source === "outlook" ? "Outlook" : "No sign-up"}</span>
                  )}
                </Link>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
