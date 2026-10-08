import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
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

  const email = await finishMicrosoftLogin({
    code: q.get("code") ?? "",
    state: q.get("state") ?? "",
    cookie,
    redirectUri: `${base}/auth/microsoft/callback`,
  });
  if (!email) return back("failed");

  // Only people on the roster can sign in
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!user || !user.active) return Response.redirect(`${base}/login?ms=notlisted&email=${encodeURIComponent(email)}`, 302);

  await startSession(user.id);
  return Response.redirect(`${base}${user.onboardedAt ? "/signup" : "/welcome"}`, 302);
}
