"use client"

import Image from "next/image"
import Link from "next/link"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ChevronDown, Coins, LogOut, Pencil, User } from "lucide-react"

type UserType = {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
}

export function UserProfileMenu({
  user,
  onSignOut,
}: {
  user: UserType
  onSignOut: (formData: FormData) => Promise<void>
}) {
  const displayName = user.name ?? user.email ?? "User"
  const initials = (displayName ?? "U").charAt(0).toUpperCase()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="group flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition-all hover:border-border hover:bg-accent/30">
          <div className="relative size-7 shrink-0 overflow-hidden rounded-full ring-1 ring-border/60">
            {user.image ? (
              <Image
                src={user.image}
                alt={displayName}
                fill
                className="object-cover"
                referrerPolicy="no-referrer"
                sizes="28px"
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-violet-100 text-[11px] font-semibold text-violet-600">
                {initials}
              </div>
            )}
          </div>
          <div className="hidden min-w-0 flex-col text-left leading-tight sm:flex">
            <span className="truncate text-sm font-medium text-foreground">
              {user.name ?? "User"}
            </span>
          </div>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground/60 transition-transform group-data-[state=open]:rotate-180 sm:block" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-60 rounded-xl border border-border p-0 shadow-lg">
        {/* User info header */}
        <div className="flex items-center gap-3 border-b border-border p-3.5">
          <div className="relative size-9 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
            {user.image ? (
              <Image
                src={user.image}
                alt={displayName}
                fill
                className="object-cover"
                referrerPolicy="no-referrer"
                sizes="36px"
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-violet-100 text-sm font-semibold text-violet-600">
                {initials}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">
              {user.name ?? "User"}
            </div>
            {user.email && (
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            )}
          </div>
        </div>

        {/* Menu items */}
        <div className="p-1.5 space-y-0.5">
          <Button
            variant="ghost"
            asChild
            className="w-full justify-start gap-2.5 rounded-lg text-sm font-normal"
          >
            <Link href="/admin/my-points">
              <Coins className="h-4 w-4 text-muted-foreground" />
              My Points
            </Link>
          </Button>
          <Button
            variant="ghost"
            asChild
            className="w-full justify-start gap-2.5 rounded-lg text-sm font-normal"
          >
            <Link href={`/profile/${user.id}`}>
              <User className="h-4 w-4 text-muted-foreground" />
              View profile
            </Link>
          </Button>
          <Button
            variant="ghost"
            asChild
            className="w-full justify-start gap-2.5 rounded-lg text-sm font-normal"
          >
            <Link href={`/profile/${user.id}/edit`}>
              <Pencil className="h-4 w-4 text-muted-foreground" />
              Edit profile
            </Link>
          </Button>
          <div className="my-1 h-px bg-border" />
          <form action={onSignOut}>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2.5 rounded-lg text-sm font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  )
}
