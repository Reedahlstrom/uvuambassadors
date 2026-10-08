import "server-only";
import crypto from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

// "Sign in with Microsoft" (UVU accounts are Microsoft 365). OpenID Connect, authorization code + PKCE.
// Turn on with MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET and MICROSOFT_TENANT_ID (UVU's Directory ID).
// The tenant must be one specific directory: in a multi-tenant setup anyone can create their own directory
// with an account whose email matches a roster member, so email claims are only trusted from UVU's tenant.

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const microsoftEnabled = () =>
  !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && GUID.test(process.env.MICROSOFT_TENANT_ID ?? "")) &&
  // Redirects must use the real site address, never one taken from request headers
  (process.env.NODE_ENV !== "production" || !!process.env.APP_URL);

const tenant = () => process.env.MICROSOFT_TENANT_ID!;
const authority = () => `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0`;
const jwks = createRemoteJWKSet(new URL("https://login.microsoftonline.com/common/discovery/v2.0/keys"));

export const MS_COOKIE = "ua_ms";
const b64url = (b: Buffer) => b.toString("base64url");

export function startMicrosoftLogin(redirectUri: string) {
  const state = b64url(crypto.randomBytes(24));
  const nonce = b64url(crypto.randomBytes(24));
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  const q = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: "openid profile email",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return { url: `${authority()}/authorize?${q}`, cookie: JSON.stringify({ state, nonce, verifier }) };
}

/** Returns the signed-in person's email (lowercase), or null if anything doesn't check out. */
export async function finishMicrosoftLogin(opts: { code: string; state: string; cookie: string | undefined; redirectUri: string }) {
  let saved: { state: string; nonce: string; verifier: string };
  try {
    saved = JSON.parse(opts.cookie ?? "");
  } catch {
    return null;
  }
  if (!saved.state || saved.state !== opts.state) return null;

  const res = await fetch(`${authority()}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirectUri,
      code_verifier: saved.verifier,
    }),
  });
  if (!res.ok) {
    console.error("Microsoft token exchange failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) return null;

  try {
    const { payload } = await jwtVerify(id_token, jwks, { audience: process.env.MICROSOFT_CLIENT_ID });
    const tid = String(payload.tid ?? "");
    if (tid.toLowerCase() !== tenant().toLowerCase()) return null;
    if (payload.iss !== `https://login.microsoftonline.com/${tid}/v2.0`) return null;
    if (payload.nonce !== saved.nonce) return null;
    const email = String(payload.email ?? payload.preferred_username ?? payload.upn ?? "").trim().toLowerCase();
    return email.includes("@") ? email : null;
  } catch (e) {
    console.error("Microsoft id_token check failed", e);
    return null;
  }
}
