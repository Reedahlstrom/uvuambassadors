import { requireRole } from "@/lib/auth";
import type { Metadata } from "next";
import { asc, count, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { PeopleAdmin } from "./people-admin";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage() {
  await requireRole("admin");
  const db = await getDb();
  const [users, teams, sizes] = await Promise.all([
    db.select().from(schema.users).orderBy(asc(schema.users.name)),
    db.select().from(schema.teams).orderBy(asc(schema.teams.name)),
    db.select({ teamId: schema.users.teamId, n: count() }).from(schema.users).where(eq(schema.users.active, true)).groupBy(schema.users.teamId),
  ]);
  const size = new Map(sizes.map((s) => [s.teamId, s.n]));
  return (
    <PeopleAdmin
      people={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        teamId: u.teamId,
        active: u.active,
        signedIn: !!u.lastLoginAt,
      }))}
      teams={teams.map((t) => ({ id: t.id, name: t.name, managerId: t.managerId, size: size.get(t.id) ?? 0 }))}
    />
  );
}
