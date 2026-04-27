import { z } from "zod";

const messageTypeSchema = z.enum(["text", "image", "audio", "file"]);

export const messageCreateSchema = z.object({
  senderId: z.string().min(1, "Sender is required"),
  recipientId: z.string().min(1, "Recipient is required"),
  content: z.string().min(1, "Content is required").max(5000),
  fileUrl: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v === "" || v == null ? undefined : v))
    .refine((v) => v === undefined || v.startsWith("http"), {
      message: "File URL must be a valid URL",
    }),
  messageType: messageTypeSchema.default("text"),
  isRead: z.preprocess((v) => v === "on" || v === true, z.boolean()).optional(),
});

export const messageUpdateSchema = z.object({
  id: z.string().uuid(),
  senderId: z.string().min(1, "Sender is required").optional(),
  recipientId: z.string().min(1, "Recipient is required").optional(),
  content: z.string().min(1, "Content is required").max(5000).optional(),
  fileUrl: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v === "" || v == null ? undefined : v))
    .refine((v) => v === undefined || v.startsWith("http"), {
      message: "File URL must be a valid URL",
    }),
  messageType: messageTypeSchema.optional(),
  isRead: z.preprocess((v) => v === "on" || v === true, z.boolean()).optional(),
});

export const messageDeleteSchema = z.object({
  id: z.string().uuid(),
});

