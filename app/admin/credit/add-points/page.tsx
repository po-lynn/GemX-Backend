import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { connection } from "next/server"
import { getAllUsersFromDb } from "@/features/users/db/users"
import { AdminCreditPointsForm } from "@/features/points/components/AdminCreditPointsForm"

export default async function AdminCreditAddPointsPage() {
  await connection()
  const users = await getAllUsersFromDb()

  return (
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            <ChevronRight />
            <Link href="/admin/credit">Points & Credits</Link>
            <ChevronRight />
            <span className="lv-here">Credit / Deduct Points</span>
          </nav>
          <h1 className="lv-h1">Credit / Deduct Points</h1>
          <p className="lv-subhead">
            Directly add or remove points from any user account. Changes take effect immediately.
          </p>
        </div>
      </div>

      <div
        className="lv-card"
        style={{ padding: "24px 28px", maxWidth: 600 }}
      >
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
