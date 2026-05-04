"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { UserRow } from "@/features/users/db/users"
import { deleteUserAction } from "@/features/users/actions/users"
import { Button } from "@/components/ui/button"
import { Search, X, ExternalLink } from "lucide-react"
import {
  AdminTableShell,
  AdminPagination,
  AdminDeleteDialog,
  AdminEmptyRow,
  adminTH,
  adminTHRight,
  adminTRClickable,
  adminTD,
} from "@/components/admin/admin-ui"

const TRUNCATE_TOKEN_LEN = 20
const SUGGEST_DEBOUNCE_MS = 300

type Props = {
  users: UserRow[]
  page: number
  totalPages: number
  total: number
  searchQuery?: string
  pushTokensByUserId?: Record<string, { token: string; platform: string | null }[]>
}

function UserAvatar({ imageUrl, name }: { imageUrl: string | null | undefined; name: string }) {
  const [error, setError] = useState(false)
  const initials = (name ?? "U").charAt(0).toUpperCase()
  return imageUrl && !error ? (
    <Image
      src={imageUrl}
      alt=""
      width={36}
      height={36}
      className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-slate-200/60"
      onError={() => setError(true)}
    />
  ) : (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-semibold text-violet-600 ring-1 ring-slate-200/60">
      {initials}
    </div>
  )
}

const ROLE_STYLE: Record<string, string> = {
  admin: "bg-violet-50 text-violet-700 ring-violet-200/60",
  escrow: "bg-sky-50 text-sky-700 ring-sky-200/60",
  user: "bg-slate-100 text-slate-600 ring-slate-200/60",
}

function RoleBadge({ role }: { role: string }) {
  const style = ROLE_STYLE[role?.toLowerCase()] ?? ROLE_STYLE.user
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${style}`}>
      {role}
    </span>
  )
}

export function UsersTable({
  users,
  page,
  totalPages,
  total,
  searchQuery = "",
  pushTokensByUserId = {},
}: Props) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [inputValue, setInputValue] = useState(searchQuery)
  const [suggestions, setSuggestions] = useState<UserRow[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const suggestAbortRef = useRef<AbortController | null>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const base = "/admin/users"

  useEffect(() => { setInputValue(searchQuery) }, [searchQuery])

  useEffect(() => {
    const q = inputValue.trim()
    if (!q) { setSuggestions([]); setShowSuggestions(false); return }
    const t = setTimeout(() => {
      suggestAbortRef.current?.abort()
      suggestAbortRef.current = new AbortController()
      setSuggestLoading(true)
      fetch(`/api/admin/users/suggest?q=${encodeURIComponent(q)}`, {
        signal: suggestAbortRef.current.signal,
      })
        .then((r) => r.json())
        .then((data: { users?: UserRow[] }) => {
          setSuggestions(data.users ?? [])
          setShowSuggestions(true)
        })
        .catch(() => setSuggestions([]))
        .finally(() => setSuggestLoading(false))
    }, SUGGEST_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [inputValue])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function buildHref(p: number) {
    const params = new URLSearchParams()
    if (searchQuery) params.set("search", searchQuery)
    params.set("page", String(p))
    return `${base}?${params.toString()}`
  }

  function handleSearchSubmit() {
    const q = inputValue.trim()
    setShowSuggestions(false)
    router.push(q ? `${base}?search=${encodeURIComponent(q)}&page=1` : base)
  }

  function handleSuggestionClick(u: UserRow) {
    const q = u.name
    setInputValue(q)
    setShowSuggestions(false)
    router.push(`${base}?search=${encodeURIComponent(q)}&page=1`)
  }

  function handleClear() {
    setInputValue("")
    setShowSuggestions(false)
    router.push(base)
  }

  return (
    <>
      {/* Search bar */}
      <div ref={searchWrapRef} className="relative flex flex-wrap items-center gap-2">
        <div className="relative flex min-w-0 flex-1 items-center sm:min-w-[320px]">
          <Search className="pointer-events-none absolute left-3 size-4 text-slate-400" aria-hidden />
          <input
            type="search"
            placeholder="Search by name, email, phone, country…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => inputValue.trim() && setShowSuggestions(suggestions.length > 0)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-800 placeholder:text-slate-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50"
            aria-label="Search users"
          />
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Button size="sm" type="button" onClick={handleSearchSubmit} className="h-9">
          Search
        </Button>

        {showSuggestions && (suggestions.length > 0 || suggestLoading) && (
          <ul
            className="absolute left-0 top-full z-20 mt-1 w-full max-w-sm overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            role="listbox"
          >
            {suggestLoading ? (
              <li className="px-3 py-2 text-sm text-slate-400">Loading…</li>
            ) : (
              suggestions.map((u) => (
                <li
                  key={u.id}
                  role="option"
                  aria-selected={false}
                  className="cursor-pointer px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                  onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(u) }}
                >
                  <span className="font-medium text-slate-800">{u.name}</span>
                  {u.email && <span className="ml-2 text-slate-500">{u.email}</span>}
                  {u.phone && <span className="ml-2 text-slate-400">{u.phone}</span>}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* Table */}
      <AdminTableShell>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className={adminTH + " w-12 text-center"}>Photo</th>
              <th className={adminTH}>Name</th>
              <th className={adminTH}>Email</th>
              <th className={adminTH}>Role</th>
              <th className={adminTH}>Phone</th>
              <th className={adminTH}>Country</th>
              <th className={adminTH}>Products</th>
              <th className={adminTH}>Push token</th>
              <th className={adminTHRight}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <AdminEmptyRow colSpan={9} message="No users found." />
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`${base}/${u.id}/edit`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      router.push(`${base}/${u.id}/edit`)
                    }
                  }}
                  className={adminTRClickable}
                >
                  <td className="px-4 py-2.5 text-center">
                    <UserAvatar imageUrl={u.image} name={u.name} />
                  </td>
                  <td className={adminTD}>
                    <span className="font-medium text-slate-800">{u.name}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{u.email}</td>
                  <td className={adminTD}>
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{u.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{u.country ?? "—"}</td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link
                      href={`/admin/users/${u.id}/products`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                    >
                      View
                      <ExternalLink className="size-3" />
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    {(() => {
                      const tokens = pushTokensByUserId[u.id]
                      if (!tokens?.length) return "—"
                      const first = tokens[0]
                      const truncated =
                        first.token.length > TRUNCATE_TOKEN_LEN
                          ? `${first.token.slice(0, TRUNCATE_TOKEN_LEN)}…`
                          : first.token
                      return tokens.length === 1 ? (
                        <span title={first.token}>{truncated}</span>
                      ) : (
                        <span title={tokens.map((t) => t.token).join("\n")}>
                          {truncated} <span className="text-slate-500">+{tokens.length - 1}</span>
                        </span>
                      )
                    })()}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ id: u.id, name: u.name })}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label={`Delete ${u.name}`}
                    >
                      <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <AdminPagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageCount={users.length}
          buildHref={buildHref}
        />
      </AdminTableShell>

      <AdminDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete user"
        description={
          <>
            Delete <strong>{deleteTarget?.name}</strong>? This will remove their
            account and all associated data. This cannot be undone.
          </>
        }
        onDelete={async () => {
          if (!deleteTarget) return
          const form = new FormData()
          form.set("userId", deleteTarget.id)
          const result = await deleteUserAction(form)
          if (result?.error) return result.error
          router.refresh()
          setDeleteTarget(null)
        }}
      />
    </>
  )
}
