import { z } from "zod";

const hexCodeSchema = z
  .union([
    z.literal(""),
    z.string().regex(/^#[0-9a-fA-F]{6}$/, "Hex code must look like #9B111E"),
  ])
  .default("");

export const colorCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  hexCode: hexCodeSchema,
});

export const colorUpdateSchema = colorCreateSchema.partial().extend({
  colorId: z.string().uuid(),
});

export const colorDeleteSchema = z.object({
  colorId: z.string().uuid(),
});

export type ColorCreate = z.infer<typeof colorCreateSchema>;
export type ColorUpdate = z.infer<typeof colorUpdateSchema>;
