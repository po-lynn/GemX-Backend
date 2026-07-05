import { db } from "@/drizzle/db";
import { color } from "@/drizzle/schema/color-schema";
import { eq } from "drizzle-orm";

export type ColorOption = {
  id: string;
  name: string;
  hexCode: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ColorForEdit = ColorOption;

export async function getAllColors(): Promise<ColorOption[]> {
  return db
    .select({
      id: color.id,
      name: color.name,
      hexCode: color.hexCode,
      createdAt: color.createdAt,
      updatedAt: color.updatedAt,
    })
    .from(color)
    .orderBy(color.name);
}

export async function getColorById(id: string): Promise<ColorForEdit | null> {
  const row = await db
    .select({
      id: color.id,
      name: color.name,
      hexCode: color.hexCode,
      createdAt: color.createdAt,
      updatedAt: color.updatedAt,
    })
    .from(color)
    .where(eq(color.id, id))
    .limit(1);
  return row[0] ?? null;
}

export async function createColorInDb(input: {
  name: string;
  hexCode: string;
}): Promise<string> {
  const [inserted] = await db
    .insert(color)
    .values({ name: input.name, hexCode: input.hexCode })
    .returning({ id: color.id });
  return inserted!.id;
}

export async function updateColorInDb(
  id: string,
  input: { name?: string; hexCode?: string }
): Promise<boolean> {
  const updates = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined)
  );
  if (Object.keys(updates).length === 0) return true;
  await db.update(color).set(updates).where(eq(color.id, id));
  return true;
}

export async function deleteColorInDb(id: string): Promise<boolean> {
  const deleted = await db
    .delete(color)
    .where(eq(color.id, id))
    .returning({ id: color.id });
  return deleted.length > 0;
}
