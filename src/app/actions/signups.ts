"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function addToEvent(eventId: string, userId: string, enforceRules: boolean): Promise<ActionResult> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    // Lock the event row so two people can't grab the last spot at the same time
    const [event] = await tx.select().from(schema.events).where(eq(schema.events.id, eventId)).for("update");
    if (!event) return { ok: false, error: "This was removed." } as const;
    if (event.spots == null) return { ok: false, error: "This one doesn't take sign-ups." } as const;
    if (enforceRules && event.startsAt <= new Date()) return { ok: false, error: "This already started." } as const;

    const [{ n }] = await tx
      .select({ n: count() })
      .from(schema.signups)
      .where(eq(schema.signups.eventId, eventId));
    if (enforceRules && n >= event.spots) return { ok: false, error: "Sorry, it just filled up." } as const;

    const inserted = await tx.insert(schema.signups).values({ eventId, userId }).onConflictDoNothing().returning();
    if (inserted.length === 0) return { ok: true, message: "Already signed up" } as const;
    return { ok: true } as const;
  });
}

export async function signUp(eventId: string): Promise<ActionResult> {
  const user = await requireUser();
  const r = await addToEvent(eventId, user.id, true);
  revalidatePath("/", "layout");
  return r.ok ? { ok: true, message: "You're signed up" } : r;
}

export async function dropSignup(eventId: string): Promise<ActionResult> {
  const user = await requireUser();
  const db = await getDb();
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, eventId));
  if (!event) return { ok: false, error: "This was removed." };
  if (event.startsAt <= new Date()) return { ok: false, error: "This already started." };
  await db.delete(schema.signups).where(and(eq(schema.signups.eventId, eventId), eq(schema.signups.userId, user.id)));
  revalidatePath("/", "layout");
  return { ok: true, message: "Removed" };
}

// ----- Admin roster controls (from the event panel) -----

export async function adminAddPerson(eventId: string, userId: string): Promise<ActionResult> {
  await requireRole("admin");
  const r = await addToEvent(eventId, userId, false);
  revalidatePath("/", "layout");
  return r.ok ? { ok: true, message: "Added" } : r;
}

export async function adminRemovePerson(eventId: string, userId: string): Promise<ActionResult> {
  await requireRole("admin");
  const db = await getDb();
  await db.delete(schema.signups).where(and(eq(schema.signups.eventId, eventId), eq(schema.signups.userId, userId)));
  revalidatePath("/", "layout");
  return { ok: true, message: "Removed" };
}

export async function adminSetNoShow(eventId: string, userId: string, noShow: boolean): Promise<ActionResult> {
  await requireRole("admin");
  const db = await getDb();
  await db
    .update(schema.signups)
    .set({ status: noShow ? "no_show" : "going" })
    .where(and(eq(schema.signups.eventId, eventId), eq(schema.signups.userId, userId)));
  revalidatePath("/", "layout");
  return { ok: true, message: noShow ? "Marked no-show" : "Marked attended" };
}
