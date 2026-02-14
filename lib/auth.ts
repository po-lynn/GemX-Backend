import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/drizzle/db";
import { bearer, username } from "better-auth/plugins";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      role: { type: "string", required: true },
      nrc: { type: "string", required: false, defaultValue: null },
      address: { type: "string", required: false, defaultValue: null },
      phone: { type: "string", required: false, defaultValue: null },
      city: { type: "string", required: false, defaultValue: null },
      state: { type: "string", required: false, defaultValue: null },
      country: { type: "string", required: false, defaultValue: null },
      gender: { type: "string", required: false, defaultValue: null },
    },
  },
  plugins: [username(), bearer()],
});