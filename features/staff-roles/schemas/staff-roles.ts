import { z } from "zod"
import { staffRoleEnum } from "@/drizzle/schema/staff-role-schema"

export const saveStaffRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(staffRoleEnum.enumValues).nullable(),
  isSupervisor: z.boolean(),
})

export type SaveStaffRoleBody = z.infer<typeof saveStaffRoleSchema>
