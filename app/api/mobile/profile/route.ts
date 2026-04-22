import { NextRequest, connection } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { jsonError, jsonUncached } from "@/lib/api";

const bodySchema = z
  .object({
    name: z.preprocess(
      (v) => (v === null ? undefined : v),
      z.string().trim().min(1).max(120).optional()
    ),
    address: z.union([z.string().trim().max(500), z.null()]).optional(),
    image: z.union([z.string().trim().max(2000), z.null()]).optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.address !== undefined || v.image !== undefined,
    { message: "At least one field is required" }
  );

/**
 * POST /api/mobile/profile
 * Edit current user profile fields used by mobile apps.
 */
export async function POST(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input", 400);

    const data = parsed.data;
    const payload: Partial<typeof user.$inferInsert> = {};

    if (data.name !== undefined) payload.name = data.name;
    if (data.address !== undefined) {
      payload.address = data.address && data.address.length > 0 ? data.address : null;
    }
    if (data.image !== undefined) {
      payload.image = data.image && data.image.length > 0 ? data.image : null;
    }

    const [updated] = await db
      .update(user)
      .set(payload)
      .where(eq(user.id, session.user.id))
      .returning({
        id: user.id,
        name: user.name,
        address: user.address,
        image: user.image,
        updatedAt: user.updatedAt,
      });

    if (!updated) return jsonError("Profile not found", 404);

    return jsonUncached({ success: true, profile: updated });
  } catch (error) {
    console.error("POST /api/mobile/profile:", error);
    return jsonError("Failed to update profile", 500);
  }
}

