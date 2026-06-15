import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import PortalNavbar from "@/components/portal/PortalNavbar"

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) redirect("/login")

  const role = session.user.role
  if (role === "admin" || role === "internal") redirect("/admin")
  if (role !== "portal") redirect("/")

  return (
    <div className="min-h-screen bg-background">
      <PortalNavbar userName={session.user.name} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  )
}
