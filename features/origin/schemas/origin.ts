import { z } from "zod";

export const originCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
});

export const originUpdateSchema = originCreateSchema.partial().extend({
  originId: z.string().uuid(),
});

export const originDeleteSchema = z.object({
  originId: z.string().uuid(),
});

export type OriginCreate = z.infer<typeof originCreateSchema>;
export type OriginUpdate = z.infer<typeof originUpdateSchema>;
