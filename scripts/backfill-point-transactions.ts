/**
 * One-time backfill: populate point_transaction from existing records.
 * Run once after deploying migration 0045.
 *
 *   npx tsx scripts/backfill-point-transactions.ts
 */
import { db } from "@/drizzle/db"
import { pointPurchaseRequest, pointTransaction, premiumDealersPackage } from "@/drizzle/schema/points-schema"
import { sql } from "drizzle-orm"

async function main() {
  console.log("Backfilling point_transaction from purchase requests…")

  const requests = await db
    .select({
      id: pointPurchaseRequest.id,
      userId: pointPurchaseRequest.userId,
      points: pointPurchaseRequest.points,
      status: pointPurchaseRequest.status,
      packageName: pointPurchaseRequest.packageName,
      paymentMethod: pointPurchaseRequest.paymentMethod,
      createdAt: pointPurchaseRequest.createdAt,
    })
    .from(pointPurchaseRequest)

  let inserted = 0
  for (const r of requests) {
    const txStatus = r.status === "approved" ? "completed" : r.status === "rejected" ? "rejected" : "pending"
    await db.insert(pointTransaction).values({
      userId: r.userId,
      type: "topup",
      direction: "credit",
      amount: r.points,
      status: txStatus,
      referenceId: r.id,
      referenceType: "purchase_request",
      description: r.paymentMethod ? `Top-up via ${r.paymentMethod}` : `Top-up · ${r.packageName}`,
      paymentMethod: r.paymentMethod ?? null,
      createdAt: r.createdAt,
    }).onConflictDoNothing()
    inserted++
  }
  console.log(`  Inserted ${inserted} topup transactions`)

  console.log("Backfilling from premium_dealers_packages…")
  const subscriptions = await db
    .select({
      id: premiumDealersPackage.id,
      userId: premiumDealersPackage.userId,
      packageName: premiumDealersPackage.packageName,
      createdAt: premiumDealersPackage.createdAt,
    })
    .from(premiumDealersPackage)

  inserted = 0
  for (const s of subscriptions) {
    // We don't have the exact cost stored on the subscription row — use 0 as placeholder.
    // The amount can be corrected later from settings if needed.
    await db.insert(pointTransaction).values({
      userId: s.userId,
      type: "premium_activation",
      direction: "debit",
      amount: 0,
      status: "completed",
      referenceId: s.id,
      referenceType: "premium_package",
      description: `Premium · ${s.packageName}`,
      createdAt: s.createdAt,
    }).onConflictDoNothing()
    inserted++
  }
  console.log(`  Inserted ${inserted} premium_activation transactions`)

  console.log("Setting pointsLifetime = sum of approved topups per user…")
  await db.execute(sql`
    UPDATE "user" u
    SET points_lifetime = COALESCE((
      SELECT SUM(pt.amount)
      FROM point_transaction pt
      WHERE pt.user_id = u.id
        AND pt.direction = 'credit'
        AND pt.status = 'completed'
    ), 0)
  `)
  console.log("  pointsLifetime updated")

  console.log("Done.")
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
