"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Check, Mail, Search, X } from "lucide-react";
import { sendReminders } from "@/app/actions/reminders";
import type { PersonProgress } from "@/lib/data";
import { needsSentence, type Reqs, type Status } from "@/lib/progress";
import { Avatar, Bar, Button, StatusPill, cx, inputClass } from "./ui";
import { useToast } from "./toast";

type Filter = "all" | Status | "none";

const REQ_COLS = [
  { key: "tour", label: "Tours", color: "var(--color-tour)" },
  { key: "event", label: "Events", color: "var(--color-event)" },
  { key: "hs_visit", label: "HS visits", color: "var(--color-hs)" },
  { key: "hs_visit_ac", label: "With AC", color: "var(--color-hs)" },
] as const;

export function PeopleTable({
  people,
  reqs,
  showTeam,
  teams,
  canRemind,
}: {
  people: PersonProgress[];
  reqs: Reqs;
  showTeam?: boolean;
  teams?: { id: string; name: string }[];
  canRemind: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [team, setTeam] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState(false);

  const base = useMemo(() => people.filter((p) => (!team || p.teamId === team) && (!q || p.name.toLowerCase().includes(q.toLowerCase()))), [people, team, q]);
  const counts = {
    all: base.length,
    behind: base.filter((p) => p.status === "behind").length,
    on_track: base.filter((p) => p.status === "on_track").length,
    complete: base.filter((p) => p.status === "complete").length,
    none: base.filter((p) => p.total === 0).length,
  };
  const rows = base
    .filter((p) => (filter === "all" ? true : filter === "none" ? p.total === 0 : p.status === filter))
    .sort((a, b) => rank(a.status) - rank(b.status) || a.name.localeCompare(b.name));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allShown = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allShown ? new Set() : new Set(rows.map((r) => r.id)));

  const chips: { v: Filter; label: string }[] = [
    { v: "all", label: "Everyone" },
    { v: "behind", label: "Behind" },
    { v: "on_track", label: "On track" },
    { v: "complete", label: "Complete" },
    { v: "none", label: "No sign-ups" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.v}
            onClick={() => setFilter(c.v)}
            className={cx(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
              filter === c.v ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-2 hover:bg-canvas",
            )}
          >
            {c.label}
            <span className={cx("tabular-nums", filter === c.v ? "text-white/75" : "text-muted")}>{counts[c.v]}</span>
          </button>
        ))}
        <div className="ml-auto flex w-full gap-2 sm:w-auto">
          {teams && teams.length > 0 && (
            <select value={team} onChange={(e) => setTeam(e.target.value)} className={inputClass + " h-9 w-auto py-0 text-sm"} aria-label="Team">
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {people.length > 12 && (
            <div className="relative flex-1 sm:w-52 sm:flex-none">
              <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className={inputClass + " h-9 pl-9 text-sm"} />
            </div>
          )}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-white shadow-soft md:block">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-line text-left text-[13px] text-muted">
              {canRemind && (
                <th className="w-12 py-3 pl-5">
                  <Checkbox checked={allShown} onChange={toggleAll} label="Select all" />
                </th>
              )}
              <th className={cx("py-3 font-medium", !canRemind && "pl-5")}>Name</th>
              {showTeam && <th className="py-3 font-medium">Team</th>}
              {REQ_COLS.map((c) => (
                <th key={c.key} className="w-[118px] py-3 font-medium">
                  {c.label}
                </th>
              ))}
              <th className="w-[130px] py-3 pr-5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={p.id} className={cx("transition-colors", selected.has(p.id) ? "bg-brand-soft/40" : "hover:bg-canvas/70")}>
                {canRemind && (
                  <td className="py-3 pl-5">
                    <Checkbox checked={selected.has(p.id)} onChange={() => toggle(p.id)} label={`Select ${p.name}`} />
                  </td>
                )}
                <td className={cx("py-3", !canRemind && "pl-5")}>
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} size={32} />
                    <div className="min-w-0">
                      <Link href={`/people/${p.id}`} className="block truncate font-medium text-ink hover:text-brand hover:underline">
                        {p.name}
                      </Link>
                      {p.neverLoggedIn && <p className="text-xs text-muted">Hasn&apos;t signed in yet</p>}
                    </div>
                  </div>
                </td>
                {showTeam && <td className="max-w-[160px] truncate py-3 pr-4 text-ink-2">{p.teamName ?? "—"}</td>}
                {REQ_COLS.map((c) => (
                  <td key={c.key} className="py-3 pr-6">
                    <ReqCell done={p.tally[c.key].done} scheduled={p.tally[c.key].scheduled} need={reqs[c.key]} color={c.color} />
                  </td>
                ))}
                <td className="py-3 pr-5">
                  <StatusPill status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-12 text-center text-muted">No one here.</p>}
      </div>

      {/* Phone cards */}
      <div className="space-y-2 md:hidden">
        {rows.map((p) => (
          <div
            key={p.id}
            className={cx("rounded-2xl border bg-white p-4 shadow-soft", selected.has(p.id) ? "border-brand" : "border-line")}
            onClick={canRemind ? () => toggle(p.id) : undefined}
          >
            <div className="mb-3 flex items-center gap-3">
              {canRemind && <Checkbox checked={selected.has(p.id)} onChange={() => toggle(p.id)} label={`Select ${p.name}`} />}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/people/${p.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="block truncate font-medium text-ink underline decoration-line underline-offset-4"
                >
                  {p.name}
                </Link>
                {showTeam && <p className="text-xs text-muted">{p.teamName}</p>}
              </div>
              <StatusPill status={p.status} />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {REQ_COLS.map((c) => (
                <div key={c.key}>
                  <p className="mb-1 text-[11px] text-muted">{c.label}</p>
                  <ReqCell done={p.tally[c.key].done} scheduled={p.tally[c.key].scheduled} need={reqs[c.key]} color={c.color} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Selection bar */}
      {canRemind && selected.size > 0 && (
        <div className="anim-sheet fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6">
          <div className="flex items-center gap-2 rounded-2xl bg-ink py-2 pr-2 pl-4 text-white shadow-pop">
            <span className="mr-2 text-[15px] font-medium tabular-nums">{selected.size} selected</span>
            <Button size="sm" variant="outline" className="border-transparent" onClick={() => setComposing(true)}>
              <Mail size={15} /> Send reminder
            </Button>
            <button onClick={() => setSelected(new Set())} className="rounded-xl p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Clear">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {composing && (
        <ReminderModal
          people={people.filter((p) => selected.has(p.id))}
          reqs={reqs}
          onClose={() => setComposing(false)}
          onSent={() => {
            setComposing(false);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}

const rank = (s: Status) => (s === "behind" ? 0 : s === "on_track" ? 1 : 2);

function ReqCell({ done, scheduled, need, color }: { done: number; scheduled: number; need: number; color: string }) {
  const have = done + scheduled;
  return (
    <div title={`${done} done · ${scheduled} signed up`}>
      <p className="mb-1 text-sm tabular-nums">
        <span className={cx("font-semibold", done >= need ? "text-brand" : have >= need ? "text-good" : "text-ink")}>{have}</span>
        <span className="text-muted">/{need}</span>
      </p>
      <Bar value={done} soft={scheduled} max={need} color={color} />
    </div>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cx(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
        checked ? "border-brand bg-brand" : "border-[#cbcfcc] bg-white hover:border-brand",
      )}
    >
      {checked && <Check size={13} strokeWidth={3} className="text-white" />}
    </button>
  );
}

function ReminderModal({
  people,
  reqs,
  onClose,
  onSent,
}: {
  people: PersonProgress[];
  reqs: Reqs;
  onClose: () => void;
  onSent: () => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const needing = people.filter((p) => needsSentence(p.tally, reqs));
  const sample = needing[0];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Send reminder">
      <button className="anim-fade absolute inset-0 bg-ink/25" onClick={onClose} aria-label="Close" />
      <div className="anim-sheet absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-pop md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[520px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-xl font-semibold text-ink">
            Remind {needing.length} {needing.length === 1 ? "person" : "people"}
          </p>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-canvas" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {sample ? (
          <div className="rounded-2xl bg-canvas p-4 text-[15px] leading-relaxed text-ink-2">
            <p>Hi {sample.name.split(" ")[0]},</p>
            <p className="mt-2">You still need {needsSentence(sample.tally, reqs)} this semester.</p>
            {note.trim() && <p className="mt-2 whitespace-pre-line">{note.trim()}</p>}
            <p className="mt-3">
              <span className="inline-block rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white">See open spots</span>
            </p>
          </div>
        ) : (
          <p className="rounded-2xl bg-canvas p-4 text-muted">Everyone selected is already fully signed up.</p>
        )}

        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Add a note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            className={inputClass + " h-auto py-2.5"}
            placeholder="Tours fill up fast in November!"
          />
        </label>
        {people.length > needing.length && (
          <p className="mt-2 text-sm text-muted">{people.length - needing.length} already covered — they won&apos;t get an email.</p>
        )}

        <Button
          size="lg"
          className="mt-5 w-full"
          disabled={pending || needing.length === 0}
          onClick={() =>
            start(async () => {
              const r = await sendReminders(
                needing.map((p) => p.id),
                note,
              );
              if (r.ok) {
                toast(`Reminder sent to ${r.sent}`);
                onSent();
              } else toast(r.error, "error");
            })
          }
        >
          {pending ? "Sending…" : `Send to ${needing.length}`}
        </Button>
      </div>
    </div>
  );
}
