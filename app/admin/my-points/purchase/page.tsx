import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { headers } from "next/headers"
import { connection } from "next/server"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getAllUsersFromDb } from "@/features/users/db/users"
import { AdminCreditPointsForm } from "@/features/points/components/AdminCreditPointsForm"

export default async function AdminMyPointsPurchasePage() {
  await connection()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) redirect("/login")

  const users = await getAllUsersFromDb()

  return (
    <div className="py-2" style={{ maxWidth: 600 }}>
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            <ChevronRight />
            <Link href="/admin/my-points">My Points</Link>
            <ChevronRight />
            <span className="lv-here">Credit / Deduct</span>
          </nav>
          <h1 className="lv-h1">Credit / Deduct Points</h1>
          <p className="lv-subhead">
            Directly add or remove points from any user account. Changes take effect immediately.
          </p>
        </div>
      </div>

      <div className="lv-card" style={{ padding: "24px 28px" }}>
        <AdminCreditPointsForm
          users={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            points: u.points,
            role: u.role,
          }))}
        />
      </div>
    </div>
  )
}
