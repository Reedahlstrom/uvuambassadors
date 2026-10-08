import { cookies } from "next/headers";
import { MS_COOKIE, microsoftEnabled, startMicrosoftLogin } from "@/lib/microsoft";
import { baseUrl } from "@/lib/url";

export async function GET() {
  const base = await baseUrl();
  if (!microsoftEnabled()) return Response.redirect(`${base}/login`, 302);
  const { url, cookie } = startMicrosoftLogin(`${base}/auth/microsoft/callback`);
  const jar = await cookies();
  jar.set(MS_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth/microsoft",
    maxAge: 600,
  });
  return Response.redirect(url, 302);
}
