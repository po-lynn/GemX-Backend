import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/drizzle/db";
import { bearer, username } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { user as userTable } from "@/drizzle/schema/auth-schema";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      role: { type: "string", required: true },
      image: { type: "string", required: false, defaultValue: null },
      nrc: { type: "string", required: false, defaultValue: null },
      address: { type: "string", required: false, defaultValue: null },
      phone: { type: "string", required: false, defaultValue: null },
      city: { type: "string", required: false, defaultValue: null },
      state: { type: "string", required: false, defaultValue: null },
      country: { type: "string", required: false, defaultValue: null },
      gender: { type: "string", required: false, defaultValue: null },
      dateOfBirth: { type: "string", required: false, defaultValue: null },
      points: { type: "number", required: false, defaultValue: 0 },
      archived: { type: "boolean", required: false, defaultValue: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const [row] = await db
            .select({ archived: userTable.archived })
            .from(userTable)
            .where(eq(userTable.id, session.userId))
            .limit(1);
          if (row?.archived) return false;
        },
      },
    },
  },
  plugins: [username(), bearer(), admin()],
});