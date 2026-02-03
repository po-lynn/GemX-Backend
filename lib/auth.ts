import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/drizzle/db"; // your drizzle instance
import { bearer, username } from "better-auth/plugins";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg", // or "mysql", "sqlite"
    }),
    emailAndPassword: { enabled: true },
    user: {
    additionalFields: {
      role: { type: "string", required: true },  // "mobile" | "admin"
      phone: { type: "string", required: false, defaultValue: null },
    },
  },

  // Mobile uses Bearer tokens; phone is used as username
  plugins: [username(), bearer()],
});