"use server";

import { and, asc, count, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { consumeLoginCode, consumeLoginToken, createLoginToken, endSession, recentLoginRequests, startSession } from "@/lib/auth";
import { DEMO_EMAILS, DEMO_MODE } from "@/lib/config";
import { getDb, schema } from "@/lib/db";
import { emailEnabled, sendEmail } from "@/lib/email";
import { baseUrl } from "@/lib/url";

export type LoginState = {
  step: "email" | "code";
  email?: string;
  error?: string;
  devCode?: string;
};

async function findUser(email: string) {
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email.trim().toLowerCase()));
  return user && user.active ? user : null;
}

function landingFor(user: { onboardedAt: Date | null }) {
  return user.onboardedAt ? "/signup" : "/welcome";
}

export async function requestLogin(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return { step: "email", email, error: "Enter your email." };
  const user = await findUser(email);
  if (!user) return { step: "email", email, error: "That email isn't on the ambassador list. Ask your manager to add you." };
  if ((await recentLoginRequests(user.id)) >= 3) {
    return { step: "email", email, error: "Too many codes requested. Use the last one we sent, or try again in 15 minutes." };
  }

  const { token, code } = await createLoginToken(user.id);
  const url = `${await baseUrl()}/auth/verify?token=${token}`;
  const sent = await sendEmail({
    to: user.email,
    toUserId: user.id,
    kind: "login",
    subject: `Your sign-in code: ${code}`,
    heading: `Your code is ${code}`,
    lines: ["Enter this code to sign in, or tap the button below.", "It expires in 30 minutes."],
    button: { label: "Sign in", url },
  });
  if (!sent) return { step: "email", email, error: "We couldn't send your code. Try again in a minute." };
  return { step: "code", email, devCode: !emailEnabled && DEMO_MODE ? code : undefined };
}

export async function verifyCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const code = String(form.get("code") ?? "");
  const user = await findUser(email);
  if (!user) return { step: "email", error: "Something went wrong. Try again." };
  const ok = await consumeLoginCode(user.id, code);
  if (!ok) return { step: "code", email, error: "That code didn't work. Check your email and try again." };
  await startSession(user.id);
  redirect(landingFor(user));
}

export async function verifyLink(token: string) {
  const userId = await consumeLoginToken(token);
  if (!userId) redirect("/login?expired=1");
  await startSession(userId);
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  redirect(landingFor(user));
}

async function firstWithRole(role: "ambassador" | "manager" | "admin") {
  const db = await getDb();
  const [row] = await db
    .select({ user: schema.users })
    .from(schema.users)
    .leftJoin(schema.signups, eq(schema.signups.userId, schema.users.id))
    .where(and(eq(schema.users.role, role), eq(schema.users.active, true)))
    .groupBy(schema.users.id)
    .orderBy(desc(count(schema.signups.id)), asc(schema.users.name))
    .limit(1);
  return row?.user ?? null;
}

export async function demoLogin(role: "ambassador" | "manager" | "admin") {
  if (!DEMO_MODE) throw new Error("Demo login is off");
  // On a local copy of real data there are no demo people, so use a real person with that role
  // (for ambassadors, the one with the most sign-ups so there's something to look at).
  const user = (await findUser(DEMO_EMAILS[role])) ?? (await firstWithRole(role));
  if (!user) throw new Error(`No ${role} in this database`);
  await startSession(user.id);
  redirect(landingFor(user));
}

export async function signOut() {
  await endSession();
  redirect("/login");
}
