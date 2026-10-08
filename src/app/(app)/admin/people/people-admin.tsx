"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Pencil, Plus, Search, Upload, X } from "lucide-react";
import { deleteTeam, savePerson, saveTeam, type FormState } from "@/app/actions/admin";
import { useToast } from "@/components/toast";
import { Avatar, Button, ButtonLink, Card, Field, cx, inputClass } from "@/components/ui";

type Role = "ambassador" | "manager" | "admin";
type Person = { id: string; name: string; email: string; role: Role; teamId: string | null; active: boolean; signedIn: boolean };
type Team = { id: string; name: string; managerId: string | null; size: number };

const ROLE_LABEL: Record<Role, string> = { ambassador: "Ambassador", manager: "Manager", admin: "Admin" };

export function PeopleAdmin({ people, teams }: { people: Person[]; teams: Team[] }) {
  const [role, setRole] = useState<Role | "all">("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Person | "new" | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | "new" | null>(null);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));

  const rows = people.filter(
    (p) =>
      (role === "all" || p.role === role) &&
      (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.email.includes(q.toLowerCase())),
  );
  const counts = { all: people.length, ambassador: 0, manager: 0, admin: 0 } as Record<Role | "all", number>;
  people.forEach((p) => counts[p.role]++);

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["all", "ambassador", "manager", "admin"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cx(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium",
                role === r ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-2 hover:bg-canvas",
              )}
            >
              {r === "all" ? "Everyone" : ROLE_LABEL[r] + "s"}
              <span className={role === r ? "text-white/75" : "text-muted"}>{counts[r]}</span>
            </button>
          ))}
          <div className="relative w-full sm:ml-2 sm:w-56">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className={inputClass + " h-9 pl-9 text-sm"} />
          </div>
          <div className="ml-auto flex gap-2">
            <ButtonLink href="/admin/people/import" variant="secondary" size="sm">
              <Upload size={15} /> Import
            </ButtonLink>
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus size={16} /> Add person
            </Button>
          </div>
        </div>

        <Card className="divide-y divide-line overflow-hidden">
          {rows.map((p) => (
            <div key={p.id} className={cx("flex items-center gap-3 px-4 py-3 sm:px-5", !p.active && "opacity-50")}>
              <Avatar name={p.name} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">
                  {p.name}
                  {!p.active && <span className="ml-2 text-sm font-normal text-muted">Inactive</span>}
                </p>
                <p className="truncate text-[13px] text-muted">{p.email}</p>
              </div>
              <span className="hidden w-32 text-sm text-ink-2 sm:block">{p.teamId ? teamName.get(p.teamId) : "—"}</span>
              <span
                className={cx(
                  "hidden w-28 text-sm sm:block",
                  p.role === "admin" ? "font-medium text-brand" : p.role === "manager" ? "font-medium text-event" : "text-ink-2",
                )}
              >
                {ROLE_LABEL[p.role]}
              </span>
              <span className={cx("hidden w-28 text-sm md:block", p.signedIn ? "text-good" : "text-faint")}>
                {p.signedIn ? "Signed in" : "Not yet"}
              </span>
              <button onClick={() => setEditing(p)} className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink" aria-label={`Edit ${p.name}`}>
                <Pencil size={16} />
              </button>
            </div>
          ))}
          {rows.length === 0 && <p className="py-12 text-center text-muted">No one here.</p>}
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[30px] leading-none text-ink">Teams</h2>
          <Button size="sm" variant="secondary" onClick={() => setEditingTeam("new")}>
            <Plus size={16} /> New team
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((t) => {
            const mgr = people.find((p) => p.id === t.managerId);
            return (
              <button
                key={t.id}
                onClick={() => setEditingTeam(t)}
                className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-left shadow-soft hover:border-brand/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{t.name}</p>
                  <p className="text-sm text-muted">
                    {mgr ? mgr.name : "No manager"} · {t.size} people
                  </p>
                </div>
                <Pencil size={15} className="text-faint" />
              </button>
            );
          })}
        </div>
      </section>

      {editing && <PersonModal person={editing === "new" ? null : editing} teams={teams} onClose={() => setEditing(null)} />}
      {editingTeam && (
        <TeamModal team={editingTeam === "new" ? null : editingTeam} people={people.filter((p) => p.active)} onClose={() => setEditingTeam(null)} />
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button className="anim-fade absolute inset-0 bg-ink/25" onClick={onClose} aria-label="Close" />
      <div className="anim-sheet absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-pop md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[480px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-xl font-semibold text-ink">{title}</p>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-canvas" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PersonModal({ person, teams, onClose }: { person: Person | null; teams: Team[]; onClose: () => void }) {
  const toast = useToast();
  const [state, action, pending] = useActionState<FormState, FormData>(savePerson, {});
  const handled = useRef<FormState | null>(null);
  useEffect(() => {
    if (state.ok && handled.current !== state) {
      handled.current = state;
      toast(state.ok);
      onClose();
    }
  }, [state, toast, onClose]);
  return (
    <Modal title={person ? "Edit person" : "Add person"} onClose={onClose}>
      <form action={action} className="space-y-4">
        {person && <input type="hidden" name="id" value={person.id} />}
        <Field label="Name">
          <input name="name" defaultValue={person?.name} className={inputClass} required autoFocus />
        </Field>
        <Field label="UVU email">
          <input name="email" type="email" defaultValue={person?.email} className={inputClass} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <select name="role" defaultValue={person?.role ?? "ambassador"} className={inputClass}>
              <option value="ambassador">Ambassador</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Field label="Team">
            <select name="teamId" defaultValue={person?.teamId ?? ""} className={inputClass}>
              <option value="">No team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {person && (
          <Field label="Status">
            <select name="active" defaultValue={person.active ? "on" : "off"} className={inputClass}>
              <option value="on">Active</option>
              <option value="off">Inactive (can't sign in)</option>
            </select>
          </Field>
        )}
        {state.error && <p className="text-sm text-bad">{state.error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
    </Modal>
  );
}

function TeamModal({ team, people, onClose }: { team: Team | null; people: Person[]; onClose: () => void }) {
  const toast = useToast();
  const [state, action, pending] = useActionState<FormState, FormData>(saveTeam, {});
  const [confirm, setConfirm] = useState(false);
  const [deleting, startDelete] = useTransition();
  const handled = useRef<FormState | null>(null);
  useEffect(() => {
    if (state.ok && handled.current !== state) {
      handled.current = state;
      toast(state.ok);
      onClose();
    }
  }, [state, toast, onClose]);
  const candidates = people.filter((p) => p.role !== "admin");
  return (
    <Modal title={team ? "Edit team" : "New team"} onClose={onClose}>
      <form action={action} className="space-y-4">
        {team && <input type="hidden" name="id" value={team.id} />}
        <Field label="Team name">
          <input name="name" defaultValue={team?.name} className={inputClass} required autoFocus />
        </Field>
        <Field label="Manager">
          <select name="managerId" defaultValue={team?.managerId ?? ""} className={inputClass}>
            <option value="">No manager</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        {state.error && <p className="text-sm text-bad">{state.error}</p>}
        <div className="flex items-center gap-2">
          <Button type="submit" size="lg" className="flex-1" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {team &&
            (confirm ? (
              <Button
                type="button"
                variant="danger"
                size="lg"
                disabled={deleting}
                onClick={() =>
                  startDelete(async () => {
                    await deleteTeam(team.id);
                    toast("Team deleted");
                    onClose();
                  })
                }
              >
                Yes, delete
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="lg" className="text-bad" onClick={() => setConfirm(true)}>
                Delete
              </Button>
            ))}
        </div>
      </form>
    </Modal>
  );
}
