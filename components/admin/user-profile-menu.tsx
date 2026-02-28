"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import * as React from "react"
import Link from "next/link"
type User = {
  id:string
  name?: string | null
  email?: string | null
  image?: string | null
}

export function UserProfileMenu({ user, onSignOut }: { user: User; onSignOut: (formData: FormData) => Promise<void> }) {
  const displayName = user.name ?? user.email ?? "User"
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="group flex max-w-full items-center gap-2 overflow-hidden rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-accent/10 sm:gap-3">
          <div className="size-8 shrink-0 overflow-hidden rounded-full ring-1 ring-border/50">
            {user.image ? (
              <img
                src={user.image}
                alt={displayName}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
                decoding="async"
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-accent/20 text-xs">
                {(displayName ?? "U").charAt(0)}
              </div>
            )}
          </div>
          <div className="hidden min-w-0 flex-col text-left leading-tight sm:flex">
            <span className="truncate text-sm font-medium">{user.name ?? "User"}</span>
            {user.email ? (
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            ) : null}
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 rounded-xl border border-border p-0 shadow-lg">
        <div className="flex items-center gap-3 border-b border-border p-3">
          <div className="size-10 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
            {user.image ? (
              <img
                src={user.image}
                alt={displayName}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
                decoding="async"
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-accent/20 text-sm">
                {(displayName ?? "U").charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{user.name ?? "User"}</div>
            {user.email ? <div className="truncate text-xs text-muted-foreground">{user.email}</div> : null}
          </div>
        </div>

        <div className="p-2 space-y-0.5">
          <Button variant="ghost" asChild className="w-full justify-start rounded-lg">
            <Link href={`/profile/${user.id}`}>View profile</Link>
          </Button>
          <Button variant="ghost" asChild className="w-full justify-start rounded-lg">
            <Link href={`/profile/${user.id}/edit`}>Edit profile</Link>
          </Button>
          <form action={onSignOut}>
            <Button variant="ghost" className="w-full justify-start rounded-lg text-muted-foreground hover:text-foreground">Sign out</Button>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  )
}
