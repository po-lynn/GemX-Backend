/**
 * Admin user seed – creates one admin user for dashboard access.
 * Uses better-auth signUpEmail (same as mobile register) with role "admin".
 *
 * Set ADMIN_EMAIL and ADMIN_PASSWORD in .env, or they default for local dev only.
 * Run: npx tsx data/seed-admin.ts
 */
import "dotenv/config"
import { auth } from "@/lib/auth"

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL ?? "admin@gemx.com"
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ?? "gemx@2026"
const ADMIN_NAME = process.env.ADMIN_NAME ?? "Admin"

async function main() {
  const result = await auth.api.signUpEmail({
    body: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: ADMIN_NAME,
      role: "admin",
    },
  })

  if (result && "error" in result && result.error) {
    const msg = String(result.error)
    if (
      msg.toLowerCase().includes("duplicate") ||
      msg.toLowerCase().includes("unique") ||
      msg.toLowerCase().includes("already")
    ) {
      console.log("Admin user already exists. Skipping.")
      process.exit(0)
      return
    }
    console.error("Sign up failed:", result.error)
    process.exit(1)
  }

  console.log("Admin user created:", ADMIN_EMAIL)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
