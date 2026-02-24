import { connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getAllOrigins } from "@/features/origin/db/origin"

export async function GET() {
  await connection()
  try {
    const origins = await getAllOrigins()
    return jsonCached(origins)
  } catch (error) {
    console.error("GET /api/origins:", error)
    return jsonError("Failed to fetch origins", 500)
  }
}
