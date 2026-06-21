"use client"

import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { Gem, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function PortalNavbar({ userName }: { userName: string }) {
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/login")
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-card shadow-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Gem className="h-5 w-5 text-violet-600" />
          <span className="text-sm font-semibold tracking-tight">GemX Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:block">{userName}</span>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
