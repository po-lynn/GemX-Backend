import { connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"

export async function GET() {
  await connection()
  try {
    const laboratories = await getAllLaboratories()
    return jsonCached(laboratories)
  } catch (error) {
    console.error("GET /api/laboratories:", error)
    return jsonError("Failed to fetch laboratories", 500)
  }
}
