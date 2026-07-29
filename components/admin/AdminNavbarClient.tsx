// src/app/admin/AdminNavbarClient.tsx
"use client"

import { useSyncExternalStore } from "react"
import { authClient } from "@/lib/auth-client"
import { UserProfileMenu } from "@/components/admin/user-profile-menu"
import { NotificationBell } from "@/components/admin/NotificationBell"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AdminSearchBox } from "@/components/admin/AdminSearchBox"

const Skeleton = () => (
  <div className="ml-auto flex items-center gap-1.5">
    <div className="hidden md:block h-9 w-64 rounded-[10px] bg-accent/20 animate-pulse" />
    <div className="h-8 w-8 rounded-lg bg-accent/20 animate-pulse" />
    <div className="h-8 w-24 rounded-lg bg-accent/20 animate-pulse" />
  </div>
)

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

export default function AdminNavbarClient() {
  const router = useRouter()
  const { data: session, error } = authClient.useSession()
  const mounted = useIsMounted()

  const user = session?.user

  if (!mounted || (!session && !error)) {
    return <Skeleton />
  }

  return (
    <div className="ml-auto flex items-center gap-1.5">
      <AdminSearchBox />

      <NotificationBell />

      {user ? (
        <UserProfileMenu
          user={{
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          }}
          onSignOut={async () => {
            await authClient.signOut()
            router.push("/login")
          }}
        />
      ) : (
        <Link
          href="/login"
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent/50"
        >
          Sign in
        </Link>
      )}
    </div>
  )
}
