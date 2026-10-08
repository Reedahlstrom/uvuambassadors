import crypto from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, like, sql } from "drizzle-orm";
import { PLACEHOLDER_EMAIL_DOMAIN } from "@/lib/config";
import { startSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { MS_COOKIE, finishMicrosoftLogin, microsoftEnabled } from "@/lib/microsoft";
import { baseUrl } from "@/lib/url";

export async function GET(req: Request) {
  const base = await baseUrl();
  const back = (error: string) => Response.redirect(`${base}/login?ms=${error}`, 302);
  if (!microsoftEnabled()) return back("off");

  const q = new URL(req.url).searchParams;
  const jar = await cookies();
  const cookie = jar.get(MS_COOKIE)?.value;
  jar.delete({ name: MS_COOKIE, path: "/auth/microsoft" });
  if (q.get("error")) return back(q.get("error") === "access_denied" ? "cancelled" : "failed");

  const who = await finishMicrosoftLogin({
    code: q.get("code") ?? "",
    state: q.get("state") ?? "",
    cookie,
    redirectUri: `${base}/auth/microsoft/callback`,
  });
  if (!who) return back("failed");

  // Microsoft already proved who this is (UVU's own directory), so no code — even for managers and admins.
  // On the roster → that person and their team. Not on it → a new ambassador with no team yet.
  const db = await getDb();
  let [user] = await db.select().from(schema.users).where(eq(schema.users.email, who.email));
  if (!user && who.name) {
    // Imported from SignUpGenius without an email yet: claim that record by name
    [user] = await db
      .select()
      .from(schema.users)
      .where(
        and(
          sql`lower(${schema.users.name}) = ${who.name.toLowerCase()}`,
          like(schema.users.email, `%${PLACEHOLDER_EMAIL_DOMAIN}`),
          eq(schema.users.role, "ambassador"),
        ),
      );
    if (user) [user] = await db.update(schema.users).set({ email: who.email }).where(eq(schema.users.id, user.id)).returning();
  }
  if (!user) {
    [user] = await db
      .insert(schema.users)
      .values({
        name: who.name || who.email.split("@")[0],
        email: who.email,
        role: "ambassador",
        calendarToken: crypto.randomBytes(18).toString("base64url"),
      })
      .onConflictDoNothing()
      .returning();
    if (!user) return back("failed");
  }
  if (!user.active) return Response.redirect(`${base}/login?ms=off_account`, 302);

  await startSession(user.id, true);
  return Response.redirect(`${base}${user.onboardedAt ? "/signup" : "/welcome"}`, 302);
}
