"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"
import { Search } from "lucide-react"

type Props = {
  defaultValue?: string
}

export function ProductsSearchInput({ defaultValue = "" }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(defaultValue)

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const params = new URLSearchParams(searchParams.toString())
      if (value.trim()) {
        params.set("search", value.trim())
        params.delete("page")
      } else {
        params.delete("search")
        params.delete("page")
      }
      router.push(`/admin/products?${params.toString()}`)
    },
    [value, router, searchParams]
  )

  return (
    <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:min-w-[280px]">
      <div className="relative flex flex-1 items-center">
        <Search
          className="absolute left-3 size-4 text-muted-foreground pointer-events-none"
          aria-hidden
        />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search by title, seller, phone, email..."
          className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gem-focus)] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Search products"
        />
      </div>
      <button
        type="submit"
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        <Search className="size-4" aria-hidden />
        Search
      </button>
    </form>
  )
}
