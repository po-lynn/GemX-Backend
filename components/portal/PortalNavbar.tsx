"use client"

import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Gem, LogOut, Star } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function PortalNavbar({ userName, points }: { userName: string; points: number }) {
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/login")
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-card shadow-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/portal/products" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <Gem className="h-5 w-5 text-violet-600" />
          <span className="text-sm font-semibold tracking-tight">GemX Portal</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {points.toLocaleString()} pts
          </div>
          <Link href="/portal" className="hidden text-sm text-muted-foreground hover:text-foreground transition-colors sm:block">{userName}</Link>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
