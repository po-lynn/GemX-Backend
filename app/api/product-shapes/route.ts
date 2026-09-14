import { connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getAllProductShapes } from "@/features/product-shape/db/product-shape"

/** Public list of product shapes for product forms / mobile. No auth required. */
export async function GET() {
  await connection()
  try {
    const shapes = await getAllProductShapes()
    return jsonCached(shapes)
  } catch (error) {
    console.error("GET /api/product-shapes:", error)
    return jsonError("Failed to fetch product shapes", 500)
  }
}
