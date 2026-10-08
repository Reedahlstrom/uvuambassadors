import "server-only";
import crypto from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, count, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { getDb, schema } from "./db";
import type { Role, User } from "./db/schema";

const COOKIE = "ua_session";
const SESSION_DAYS = 60;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
    return new TextEncoder().encode("dev-only-secret-change-me-dev-only-secret");
  }
  return new TextEncoder().encode(s);
}

export async function startSession(userId: string) {
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  const db = await getDb();
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, userId));
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, secret());
    if (!payload.sub) return null;
    const db = await getDb();
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, payload.sub));
    if (!user || !user.active) return null;
    return user;
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/calendar");
  return user;
}

// ---------- Magic links ----------

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function createLoginToken(userId: string): Promise<{ token: string; code: string }> {
  const token = crypto.randomBytes(32).toString("base64url");
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const db = await getDb();
  await db.insert(schema.loginTokens).values({
    tokenHash: hash(token),
    codeHash: hash(`${userId}:${code}`),
    userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 minutes
  });
  return { token, code };
}

/** Link sign-in. Returns the user id if the token is valid, and burns the token. */
export async function consumeLoginToken(token: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .update(schema.loginTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.loginTokens.tokenHash, hash(token)),
        isNull(schema.loginTokens.usedAt),
        gt(schema.loginTokens.expiresAt, new Date()),
      ),
    )
    .returning();
  return row?.userId ?? null;
}

/** Code sign-in. Every guess uses up one of the 5 tries on each live code (atomic). */
export async function consumeLoginCode(userId: string, code: string): Promise<boolean> {
  const db = await getDb();
  const live = await db
    .update(schema.loginTokens)
    .set({ attempts: sql`${schema.loginTokens.attempts} + 1` })
    .where(
      and(
        eq(schema.loginTokens.userId, userId),
        isNull(schema.loginTokens.usedAt),
        gt(schema.loginTokens.expiresAt, new Date()),
        lt(schema.loginTokens.attempts, 5),
      ),
    )
    .returning();
  const wanted = hash(`${userId}:${code.replace(/\D/g, "")}`);
  const match = live.find((row) => row.codeHash === wanted);
  if (!match) return false;
  const used = await db
    .update(schema.loginTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.loginTokens.tokenHash, match.tokenHash), isNull(schema.loginTokens.usedAt)))
    .returning();
  return used.length === 1;
}

/** How many sign-in codes this person asked for recently (to stop code spamming). */
export async function recentLoginRequests(userId: string, minutes = 15): Promise<number> {
  const db = await getDb();
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.loginTokens)
    .where(and(eq(schema.loginTokens.userId, userId), gt(schema.loginTokens.createdAt, new Date(Date.now() - minutes * 60_000))));
  return n;
}
