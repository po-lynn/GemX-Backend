// src/app/admin/AdminNavbarClient.tsx
"use client"

import { authClient } from "@/lib/auth-client"
import { UserProfileMenu } from "@/components/admin/user-profile-menu"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function AdminNavbarClient() {
  const router = useRouter()
  const { data: session, error } = authClient.useSession()
  const user = session?.user

  // optional: display skeleton while session loads
  if (!session && !error) {
    return (
      <div className="ml-auto h-8 w-24 rounded bg-accent/20 animate-pulse" />
    )
  }

  return (
    <div className="ml-auto flex items-center gap-2">
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
            router.push("/") // optional redirect
          }}
        />
      ) : (
        <Link
          href="/login"
          className="hover:bg-accent/10 px-2 py-1 rounded text-sm font-medium"
        >
          Sign in
        </Link>
      )}
    </div>
  )
}
