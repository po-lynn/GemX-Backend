import { z } from "zod";

export const laboratoryCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  address: z.string().min(1, "Address is required").max(500),
  phone: z.string().min(1, "Phone is required").max(100),
});

export const laboratoryUpdateSchema = laboratoryCreateSchema.partial().extend({
  laboratoryId: z.string().uuid(),
});

export const laboratoryDeleteSchema = z.object({
  laboratoryId: z.string().uuid(),
});

export type LaboratoryCreate = z.infer<typeof laboratoryCreateSchema>;
export type LaboratoryUpdate = z.infer<typeof laboratoryUpdateSchema>;
