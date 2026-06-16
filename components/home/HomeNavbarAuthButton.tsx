"use client"

import { useSyncExternalStore } from "react"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

const Skeleton = () => (
  <div
    data-testid="auth-skeleton"
    className="h-9 w-24 animate-pulse rounded-md bg-muted"
  />
)

export default function HomeNavbarAuthButton() {
  const { data: session, isPending } = authClient.useSession()
  const mounted = useIsMounted()

  if (!mounted || isPending) {
    return <Skeleton />
  }

  const role = session?.user?.role

  if (role === "admin" || role === "internal") {
    return (
      <Button size="sm" asChild>
        <Link href="/admin">Dashboard</Link>
      </Button>
    )
  }

  if (role === "portal") {
    return (
      <Button size="sm" asChild>
        <Link href="/portal">My Account</Link>
      </Button>
    )
  }

  return (
    <Button size="sm" asChild>
      <Link href="/login">Sign in</Link>
    </Button>
  )
}
