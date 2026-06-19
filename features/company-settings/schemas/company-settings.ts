import { z } from "zod"

export const companySettingsSchema = z.object({
  companyUserId: z.string().min(1, "Company user account is required"),
  name: z.string().min(1, "Company name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  address: z.string().min(1, "Address is required"),
  logoUrl: z.string().url().nullable().optional(),
})

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>
