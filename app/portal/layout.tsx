import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import PortalNavbar from "@/components/portal/PortalNavbar"

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) redirect("/login")

  const role = session.user.role
  if (role === "admin" || role === "internal") redirect("/admin")
  if (role !== "portal") redirect("/")

  return (
    <div className="min-h-screen bg-background">
      <PortalNavbar userName={session.user.name} points={session.user.points ?? 0} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  )
}
