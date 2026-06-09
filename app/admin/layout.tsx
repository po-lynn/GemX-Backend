import { ReactNode, Suspense } from "react"
import { headers } from "next/headers"
import AdminNavbarClient from "@/components/admin/AdminNavbarClient"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { AdminSidebarSheet } from "@/components/admin/AdminSidebarSheet"
import { Toaster } from "sonner"
import { AdminChatNotificationProvider } from "@/features/chat/context/admin-chat-notification-context"
import { auth } from "@/lib/auth"
import { getSupervisorPermissions } from "@/features/rbac/db/permissions"

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await auth.api.getSession({ headers: await headers() })
  const role = session?.user.role ?? "user"
  const permissions = role === "supervisor" ? await getSupervisorPermissions() : {}

  return (
    <AdminChatNotificationProvider>
    <div className="admin-premium min-h-screen bg-[var(--admin-main-bg)]">
      {/* Desktop sidebar */}
      <div className="hidden md:fixed md:inset-y-0 md:left-0 md:block md:w-72">
        <AdminSidebar role={role} permissions={permissions} />
      </div>

      {/* Content */}
      <div className="md:pl-72">
        {/* Top bar */}
        <header
          className="sticky top-0 z-40 border-b shadow-sm"
          style={{
            backgroundColor: "var(--admin-header-bg)",
            borderColor: "var(--admin-header-border)",
          }}
        >
          <div className="flex h-14 items-center gap-3 px-4 md:px-6">
            <AdminSidebarSheet role={role} permissions={permissions} />

            <div className="mr-auto flex items-center gap-2.5">
              <div
                className="hidden h-6 w-px md:block"
                style={{ backgroundColor: "var(--admin-header-border)" }}
              />
              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-tight text-foreground">
                  Admin Panel
                </div>
                <div className="hidden text-[11px] text-muted-foreground md:block">
                  GemX Marketplace
                </div>
              </div>
            </div>

            <AdminNavbarClient />
          </div>
        </header>

        <Toaster position="top-right" richColors />

        {/* IMPORTANT: no mx-auto centering */}
        <main className="w-full px-3 py-5 md:px-10">
          <Suspense
            fallback={
              <div className="container my-6 animate-pulse space-y-4 rounded-xl border bg-card p-6 shadow-sm">
                <div className="h-4 w-48 rounded bg-muted" />
                <div className="mt-4 h-24 rounded-lg bg-muted/60" />
              </div>
            }
          >
            {children}
          </Suspense>
        </main>
      </div>
    </div>
    </AdminChatNotificationProvider>
  )
}
