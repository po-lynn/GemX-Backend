import { connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getAllColors } from "@/features/colors/db/color"

export async function GET() {
  await connection()
  try {
    const colors = await getAllColors()
    return jsonCached(
      colors.map(({ id, name, hexCode }) => ({ id, name, hexCode }))
    )
  } catch (error) {
    console.error("GET /api/colors:", error)
    return jsonError("Failed to fetch colors", 500)
  }
}
