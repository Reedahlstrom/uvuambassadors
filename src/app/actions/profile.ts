"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";

export async function finishOnboarding() {
  const user = await requireUser();
  const db = await getDb();
  await db.update(schema.users).set({ onboardedAt: new Date() }).where(eq(schema.users.id, user.id));
  redirect("/signup");
}
