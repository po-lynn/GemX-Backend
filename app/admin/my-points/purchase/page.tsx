import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { headers } from "next/headers"
import { connection } from "next/server"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getPaymentMethods, getPointPurchasePackagesSettings } from "@/features/points/db/points"
import { getAllUsersFromDb } from "@/features/users/db/users"
import { PurchasePageTabs } from "@/features/points/components/PurchasePageTabs"

export default async function AdminMyPointsPurchasePage() {
  await connection()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) redirect("/login")

  const [{ packages }, paymentMethods, allUsers] = await Promise.all([
    getPointPurchasePackagesSettings(),
    getPaymentMethods(),
    getAllUsersFromDb(),
  ])

  const enabledPackages = packages.filter((p) => p.enabled !== false)
  const enabledMethods  = paymentMethods.filter((m) => m.enabled !== false)

  return (
    <div className="py-2" style={{ maxWidth: 680 }}>
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            <ChevronRight />
            <Link href="/admin/my-points">My Points</Link>
            <ChevronRight />
            <span className="lv-here">Top up / Credit</span>
          </nav>
          <h1 className="lv-h1">Top up / Credit Points</h1>
          <p className="lv-subhead">
            Top up your own account via payment transfer, or directly credit any user.
          </p>
        </div>
      </div>

      <PurchasePageTabs
        packages={enabledPackages}
        paymentMethods={enabledMethods}
        users={allUsers.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          points: u.points,
          role: u.role,
        }))}
        successRedirect="/admin/my-points?filter=pending"
      />
    </div>
  )
}
