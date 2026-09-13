import { ReactNode } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Toaster } from "sonner"
import { auth } from "@/lib/auth"
import { connection } from "next/server"

export default async function AccountLayout({ children }: { children: ReactNode }) {
  await connection()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) redirect("/login")

  const name = session.user.name ?? session.user.email ?? "Account"
  const initials = name.split(" ").slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? "").join("")

  return (
    <div className="admin-premium min-h-screen" style={{ background: "var(--admin-main-bg, #f8fafc)" }}>
      <header
        className="sticky top-0 z-40 border-b shadow-sm"
        style={{ background: "var(--admin-header-bg, #fff)", borderColor: "var(--admin-header-border, #e2e8f0)" }}
      >
        <div className="flex h-14 items-center gap-4 px-4 md:px-8">
          <Link href="/" className="text-sm font-semibold tracking-tight" style={{ color: "var(--lv-text)" }}>
            GemX
          </Link>
          <span style={{ width: 1, height: 18, background: "var(--lv-border)", display: "block" }} />
          <Link
            href="/account/points"
            className="text-sm font-medium"
            style={{ color: "var(--lv-text-2)" }}
          >
            My Points
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm" style={{ color: "var(--lv-text-2)" }}>{name}</span>
            <span
              className="lv-avatar"
              data-hue={((name.charCodeAt(0) ?? 0) % 6) + 1}
              style={{ width: 30, height: 30, fontSize: 11 }}
            >
              {initials}
            </span>
          </div>
        </div>
      </header>

      <Toaster position="top-right" richColors />

      <main className="w-full px-3 py-5 md:px-10">
        {children}
      </main>
    </div>
  )
}
