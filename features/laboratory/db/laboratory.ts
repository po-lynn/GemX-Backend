import { db } from "@/drizzle/db";
import { laboratory } from "@/drizzle/schema/laboratory-schema";
import { eq } from "drizzle-orm";

export type LaboratoryOption = {
  id: string;
  name: string;
  address: string;
  phone: string;
};

export type LaboratoryForEdit = LaboratoryOption;

export async function getAllLaboratories(): Promise<LaboratoryOption[]> {
  return db
    .select({
      id: laboratory.id,
      name: laboratory.name,
      address: laboratory.address,
      phone: laboratory.phone,
    })
    .from(laboratory)
    .orderBy(laboratory.name);
}

export async function getLaboratoryById(
  id: string
): Promise<LaboratoryForEdit | null> {
  const row = await db
    .select({
      id: laboratory.id,
      name: laboratory.name,
      address: laboratory.address,
      phone: laboratory.phone,
    })
    .from(laboratory)
    .where(eq(laboratory.id, id))
    .limit(1);

  return row[0] ?? null;
}

export async function createLaboratoryInDb(input: {
  name: string;
  address: string;
  phone: string;
}): Promise<string> {
  const [inserted] = await db
    .insert(laboratory)
    .values({
      name: input.name,
      address: input.address,
      phone: input.phone,
    })
    .returning({ id: laboratory.id });

  return inserted!.id;
}

export async function updateLaboratoryInDb(
  id: string,
  input: { name?: string; address?: string; phone?: string }
): Promise<boolean> {
  const updates = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined)
  );

  if (Object.keys(updates).length === 0) return true;

  await db.update(laboratory).set(updates).where(eq(laboratory.id, id));
  return true;
}

export async function deleteLaboratoryInDb(id: string): Promise<boolean> {
  const deleted = await db
    .delete(laboratory)
    .where(eq(laboratory.id, id))
    .returning({ id: laboratory.id });

  return deleted.length > 0;
}
