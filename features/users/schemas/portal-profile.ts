import { z } from "zod"

export const portalProfileUpdateSchema = z.object({
  name:        z.string().min(1, "Name is required").max(200),
  phone:       z.string().max(50).optional().nullable(),
  gender:      z.string().max(50).optional().nullable(),
  dateOfBirth: z.string().max(20).optional().nullable(),
  nrc:         z.string().max(100).optional().nullable(),
  address:     z.string().max(500).optional().nullable(),
  city:        z.string().max(100).optional().nullable(),
  state:       z.string().max(100).optional().nullable(),
  country:     z.string().max(100).optional().nullable(),
  image:       z.string().url().max(2000).optional().nullable(),
})

export type PortalProfileUpdate = z.infer<typeof portalProfileUpdateSchema>
