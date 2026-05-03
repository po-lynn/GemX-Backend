"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"
import { Search, X } from "lucide-react"

type Props = {
  defaultValue?: string
  listPath?: string
}

export function ProductsSearchInput({ defaultValue = "", listPath = "/admin/products" }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(defaultValue)
  const listBase = listPath.replace(/\/$/, "")

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
      router.push(`${listBase}?${params.toString()}`)
    },
    [value, router, searchParams, listBase]
  )

  function handleClear() {
    setValue("")
    const params = new URLSearchParams(searchParams.toString())
    params.delete("search")
    params.delete("page")
    router.push(`${listBase}?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-[300px]">
      <div className="relative flex min-w-0 flex-1 items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-slate-400" aria-hidden />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search by title, seller, phone, email…"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-800 placeholder:text-slate-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50"
          aria-label="Search products"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 flex items-center text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <button
        type="submit"
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        Search
      </button>
    </form>
  )
}
