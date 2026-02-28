import { ReactNode, Suspense } from "react"
import AdminNavbarClient from "@/components/admin/AdminNavbarClient"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { AdminSidebarSheet } from "@/components/admin/AdminSidebarSheet"

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:fixed md:inset-y-0 md:left-0 md:block md:w-72">
        <AdminSidebar />
      </div>

      {/* Content */}
      <div className="md:pl-72">
        {/* Top bar */}
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
          <div className="flex h-14 items-center gap-3 px-4 md:px-6">
            <AdminSidebarSheet />

            <div className="mr-auto leading-tight">
              <div className="text-sm font-medium">Admin</div>
              <div className="text-xs text-muted-foreground">
                Manage products, news, articles, users, sales
              </div>
            </div>

            <AdminNavbarClient />
          </div>
        </header>

        {/* IMPORTANT: no mx-auto centering */}
        <main className="w-full px-2 py-4 md:px-3">
          <Suspense
            fallback={
              <div className="container my-6 animate-pulse space-y-4 rounded-lg bg-muted/30 p-6">
                Loading...
              </div>
            }
          >
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  )
}
