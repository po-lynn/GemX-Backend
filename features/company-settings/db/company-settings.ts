import { desc, eq } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { companySetting } from "@/drizzle/schema/company-settings-schema"

export type CompanySettings = {
  companyUserId: string | null
  name: string
  email: string
  phone: string
  address: string
  logoUrl: string | null
}

export async function getCompanySettings(): Promise<CompanySettings | null> {
  const [row] = await db
    .select({
      companyUserId: companySetting.companyUserId,
      name: companySetting.name,
      email: companySetting.email,
      phone: companySetting.phone,
      address: companySetting.address,
      logoUrl: companySetting.logoUrl,
    })
    .from(companySetting)
    .orderBy(desc(companySetting.updatedAt))
    .limit(1)

  if (!row) return null
  return { ...row, companyUserId: row.companyUserId ?? null, logoUrl: row.logoUrl ?? null }
}

export async function saveCompanySettings(input: CompanySettings): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: companySetting.id })
      .from(companySetting)
      .orderBy(desc(companySetting.updatedAt))
      .limit(1)

    if (existing) {
      await tx
        .update(companySetting)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(companySetting.id, existing.id))
      return
    }

    await tx.insert(companySetting).values(input)
  })
}
