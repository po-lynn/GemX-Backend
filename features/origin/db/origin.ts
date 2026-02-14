import { db } from "@/drizzle/db";
import { origin } from "@/drizzle/schema/origin-schema";
import { eq } from "drizzle-orm";

export type OriginOption = { id: string; name: string; country: string };

export type OriginForEdit = OriginOption;

export async function getAllOrigins(): Promise<OriginOption[]> {
  return db
    .select({ id: origin.id, name: origin.name, country: origin.country })
    .from(origin)
    .orderBy(origin.name);
}

export async function getOriginById(id: string): Promise<OriginForEdit | null> {
  const row = await db
    .select({ id: origin.id, name: origin.name, country: origin.country })
    .from(origin)
    .where(eq(origin.id, id))
    .limit(1);
  return row[0] ?? null;
}

export async function createOriginInDb(input: {
  name: string;
  country: string;
}): Promise<string> {
  const [inserted] = await db
    .insert(origin)
    .values({ name: input.name, country: input.country })
    .returning({ id: origin.id });
  return inserted!.id;
}

export async function updateOriginInDb(
  id: string,
  input: { name?: string; country?: string }
): Promise<boolean> {
  const updates = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined)
  );
  if (Object.keys(updates).length === 0) return true;
  await db.update(origin).set(updates).where(eq(origin.id, id));
  return true;
}

export async function deleteOriginInDb(id: string): Promise<boolean> {
  const deleted = await db
    .delete(origin)
    .where(eq(origin.id, id))
    .returning({ id: origin.id });
  return deleted.length > 0;
}
