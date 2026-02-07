"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"

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
    <form onSubmit={handleSubmit} className="mt-2 max-w-sm">
      <div className="flex gap-2">
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search by title, seller, phone, email..."
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Search
        </button>
      </div>
    </form>
  )
}
