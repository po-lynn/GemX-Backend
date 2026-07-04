"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { globalSearch } from "@/features/search/actions/global-search"

type Results = Awaited<ReturnType<typeof globalSearch>>

const STATUS_LABEL: Record<string, string> = {
  active: "active",
  pending: "pending",
  hidden: "draft",
  sold: "sold",
  archive: "archived",
}

export function AdminSearchBox() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Results | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchResults = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults(null); setLoading(false); return }
    setLoading(true)
    try {
      const data = await globalSearch(q)
      setResults(data)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchResults(val), 300)
  }

  const handleSelect = (href: string) => {
    router.push(href)
    setOpen(false)
    setQuery("")
    setResults(null)
  }

  const handleClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setQuery("")
    setResults(null)
    setOpen(false)
    setLoading(false)
    inputRef.current?.focus()
  }

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const hasResults = results && (results.users.length > 0 || results.products.length > 0)
  const showDropdown = open && query.trim().length >= 2

  return (
    <div ref={containerRef} className="relative hidden md:block">
      {/* Input */}
      <div
        className="flex items-center gap-2 rounded-[10px] border px-3 py-2 w-64 transition-colors"
        style={{ background: "var(--admin-main-bg)", borderColor: "var(--admin-header-border)" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Search products, users…"
          className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none min-w-0"
        />
        {loading && (
          <svg className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="10"/>
          </svg>
        )}
        {query.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="flex shrink-0 items-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          className="absolute left-0 top-full mt-1.5 w-80 rounded-xl border shadow-lg z-50 overflow-hidden"
          style={{ background: "var(--admin-header-bg)", borderColor: "var(--admin-header-border)" }}
        >
          {!hasResults && !loading && (
            <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">No results</div>
          )}

          {results && results.users.length > 0 && (
            <section>
              <div className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Users</div>
              {results.users.map((u) => (
                <button
                  key={u.id}
                  onMouseDown={() => handleSelect(`/admin/users/${u.id}/edit`)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/40 transition-colors"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {(u.name ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-foreground">{u.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{u.email}</div>
                  </div>
                  <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent/60 text-muted-foreground">{u.role}</span>
                </button>
              ))}
            </section>
          )}

          {results && results.products.length > 0 && (
            <section className={results.users.length > 0 ? "border-t" : ""} style={{ borderColor: "var(--admin-header-border)" }}>
              <div className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Products</div>
              {results.products.map((p) => (
                <button
                  key={p.id}
                  onMouseDown={() => handleSelect(`/admin/products/${p.id}/edit`)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/40 transition-colors"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/60 text-[11px]">💎</div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-foreground">{p.title}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{p.sku ?? "—"} · {STATUS_LABEL[p.status] ?? p.status}</div>
                  </div>
                </button>
              ))}
            </section>
          )}

          <div className="h-2" />
        </div>
      )}
    </div>
  )
}
