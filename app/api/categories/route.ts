import { NextRequest, connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getCategoriesByType, getAllCategories } from "@/features/categories/db/categories"

export async function GET(request: NextRequest) {
  await connection()
  try {
    const type = new URL(request.url).searchParams.get("type")
    const categories =
      type === "loose_stone" || type === "jewellery"
        ? await getCategoriesByType(type)
        : await getAllCategories()
    return jsonCached(categories)
  } catch (error) {
    console.error("GET /api/categories:", error)
    return jsonError("Failed to fetch categories", 500)
  }
}
