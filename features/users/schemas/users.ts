import { z } from "zod";

export const userCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.string().email("Invalid email").max(200).optional()
  ),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  role: z.string().min(1, "Role is required").max(50),
  phone: z.string().max(50).optional().nullable(),
  gender: z.string().max(50).optional().nullable(),
  dateOfBirth: z.string().max(20).optional().nullable(),
  nrc: z.string().max(100).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
});

export const userUpdateSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  name: z.string().min(1, "Name is required").max(200).optional(),
  email: z.string().email("Invalid email").max(200).optional(),
  role: z.string().min(1).max(50).optional(),
  phone: z.string().max(50).optional().nullable(),
  gender: z.string().max(50).optional().nullable(),
  username: z.string().max(100).optional().nullable(),
  displayUsername: z.string().max(100).optional().nullable(),
  nrc: z.string().max(100).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  dateOfBirth: z.string().max(20).optional().nullable(),
  points: z.coerce.number().int().min(0).optional(),
  verified: z
    .preprocess((v) => v === "on" || v === true, z.boolean())
    .optional(),
});

export const userDeleteSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export type UserCreate = z.infer<typeof userCreateSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
