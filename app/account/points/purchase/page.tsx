import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { headers } from "next/headers"
import { connection } from "next/server"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getPaymentMethods, getPointPurchasePackagesSettings } from "@/features/points/db/points"
import { PurchaseForm } from "@/features/points/components/PurchaseForm"

export default async function AccountPointsPurchasePage() {
  await connection()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) redirect("/login")

  const [{ packages }, paymentMethods] = await Promise.all([
    getPointPurchasePackagesSettings(),
    getPaymentMethods(),
  ])

  const enabledPackages = packages.filter((p) => p.enabled !== false)
  const enabledMethods  = paymentMethods.filter((m) => m.enabled !== false)

  return (
    <div className="py-2" style={{ maxWidth: 680 }}>
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <ChevronRight />
            <Link href="/account/points">My Points</Link>
            <ChevronRight />
            <span className="lv-here">Top up</span>
          </nav>
          <h1 className="lv-h1">Top up Points</h1>
          <p className="lv-subhead">
            Select a package, transfer the amount, then submit your receipt for approval.
          </p>
        </div>
      </div>

      <PurchaseForm packages={enabledPackages} paymentMethods={enabledMethods} />
    </div>
  )
}
