import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { PeopleTable } from "@/components/people-table";
import { Empty, PageTitle } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getProgress, getSemester, reqsOf } from "@/lib/data";
import { getDb, schema } from "@/lib/db";
import { StatTiles } from "@/components/stat-tiles";

export const metadata: Metadata = { title: "My team" };

export default async function TeamPage() {
  const user = await requireRole("manager", "admin");
  const db = await getDb();
  const teams = await db.select().from(schema.teams).where(eq(schema.teams.managerId, user.id));
  const semester = await getSemester();
  const reqs = reqsOf(semester);

  if (teams.length === 0) {
    return (
      <div>
        <PageTitle>My team</PageTitle>
        <Empty>You don&apos;t have a team yet. An admin can assign you one.</Empty>
      </div>
    );
  }

  const people = (await Promise.all(teams.map((t) => getProgress({ teamId: t.id })))).flat();

  return (
    <div>
      <PageTitle>{teams.map((t) => t.name).join(" & ")}</PageTitle>
      {people.length === 0 ? (
        <Empty>No one is on your team yet. An admin can add people.</Empty>
      ) : (
        <>
          <StatTiles people={people} />
          <PeopleTable people={people} reqs={reqs} canRemind senderName={user.name} />
        </>
      )}
    </div>
  );
}
