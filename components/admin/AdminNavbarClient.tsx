// src/app/admin/AdminNavbarClient.tsx
"use client"

import { authClient } from "@/lib/auth-client"
import { UserProfileMenu } from "@/components/admin/user-profile-menu"
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
        <div className="flex items-center gap-2">
          <button
            className="hover:bg-accent/10 px-2 py-1 rounded"
            onClick={() => authClient.signIn.social({ provider: "github" })}
          >
            Sign in with GitHub
          </button>
          <button
            className="hover:bg-accent/10 px-2 py-1 rounded"
            onClick={() => authClient.signIn.social({ provider: "google" })}
          >
            Sign in with Google
          </button>
        </div>
      )}
    </div>
  )
}
