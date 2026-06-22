"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { ListViewCard } from "@/components/admin/list-view"
import type { ColumnDef, FilterDef, GroupOption, ViewTab } from "@/components/admin/list-view"
import type { UserRow, ViewCounts } from "@/features/users/db/users"

// ─── Helpers ──────────────────────────────────────────────

function avatarHue(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 47 + id.charCodeAt(i)) & 0xffff
  return (h % 6) + 1 // 1–6
}

function initials(name: string): string {
  return (
    name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  )
}

function derivedStatus(u: UserRow): "active" | "archived" {
  return u.archived ? "archived" : "active"
}

function derivedKyc(u: UserRow): "verified" | "submitted" | "unverified" {
  if (u.verified && u.emailVerified) return "verified"
  if (u.emailVerified) return "submitted"
  return "unverified"
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

function fmtRelative(d: Date): string {
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return fmtDate(d)
}

function countryFlag(iso2: string): string {
  if (!iso2 || iso2.length < 2) return "🌐"
  return iso2
    .slice(0, 2)
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
}

// ─── Extended row type ─────────────────────────────────────

type UserRowX = UserRow & {
  _status: "active" | "archived"
  _kyc: "verified" | "submitted" | "unverified"
  _hasPush: boolean
  _hue: number
}

// ─── View tabs ────────────────────────────────────────────

const VIEW_IDS = ["all", "pending", "admins", "internals", "portals", "archived"] as const

const VIEW_LABELS: Record<string, string> = {
  all: "All", pending: "Pending", admins: "Admins", internals: "Internal", portals: "Portal", archived: "Archived",
}

// ─── Column defs ──────────────────────────────────────────

const KYC_LABELS = { verified: "Verified", submitted: "Submitted", unverified: "Unverified" }

const COLUMN_DEFS: ColumnDef<UserRowX>[] = [
  {
    id: "user", label: "User", width: 280, sortable: true,
    render: (u) => (
      <div className="u-cell-user">
        <div className="u-avatar-wrap">
          <span className="lv-avatar" data-hue={u._hue}>
            {initials(u.name)}
          </span>
          <span className={`u-avatar-status ${u._status}`} />
        </div>
        <div className="u-cell-meta">
          <span className="u-cell-name" title={u.name}>{u.name}</span>
          <span className="u-cell-id">{u.id.slice(0, 12)}…</span>
        </div>
      </div>
    ),
  },
  {
    id: "contact", label: "Contact", width: 240, sortable: true,
    render: (u) => (
      <div className="u-cell-contact">
        <span className="u-cell-email" title={u.email}>{u.email}</span>
        <span className="u-cell-phone">
          <span className={`u-cell-phone-dot${u._hasPush ? "" : " off"}`} />
          {u.phone ?? <span style={{ color: "var(--lv-text-4, #C4CBD6)" }}>No phone</span>}
        </span>
      </div>
    ),
  },
  {
    id: "role", label: "Role", width: 120, sortable: true,
    render: (u) => (
      <span className={`u-role ${u.role}`}>
        <span className="u-role-dot" />
        {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
      </span>
    ),
  },
  {
    id: "status", label: "Status", width: 110, sortable: true,
    render: (u) => (
      <span className={`lv-status ${u._status}`}>
        {u._status.charAt(0).toUpperCase() + u._status.slice(1)}
      </span>
    ),
  },
  {
    id: "kyc", label: "KYC", width: 130, sortable: true, toggleable: true,
    render: (u) => (
      <span className={`u-kyc ${u._kyc}`}>
        <span className="u-kyc-dot" />
        {KYC_LABELS[u._kyc]}
      </span>
    ),
  },
  {
    id: "location", label: "Location", width: 180, sortable: true,
    render: (u) =>
      u.country ? (
        <span className="u-loc">
          <span className="u-loc-flag">{countryFlag(u.country)}</span>
          <span className="u-loc-meta">
            <span className="u-loc-country">{u.country}</span>
            {u.city && <span className="u-loc-city">{u.city}</span>}
          </span>
        </span>
      ) : (
        <span className="u-loc-empty">—</span>
      ),
  },
  {
    id: "points", label: "Points", width: 100, sortable: true, align: "right",
    render: (u) => (
      <span className={`u-points${u.points === 0 ? " zero" : ""}`}>
        {u.points.toLocaleString()}
      </span>
    ),
  },
  {
    id: "push", label: "Push", width: 90, sortable: true, toggleable: true,
    render: (u) => (
      <span className={`u-push ${u._hasPush ? "on" : "off"}`}>
        {u._hasPush ? "Enabled" : "Off"}
      </span>
    ),
  },
  {
    id: "joined", label: "Joined", width: 130, sortable: true,
    render: (u) => (
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
        <span style={{ fontSize: 12.5, color: "var(--lv-text)", fontVariantNumeric: "tabular-nums" }}>
          {fmtDate(u.createdAt)}
        </span>
        <span style={{ fontSize: 10.5, color: "var(--lv-text-3)" }}>
          {fmtRelative(u.createdAt)}
        </span>
      </div>
    ),
  },
]

// ─── Filter defs ──────────────────────────────────────────

const FILTER_DEFS: FilterDef[] = [
  {
    id: "role", label: "Role", type: "multi",
    options: [
      { value: "admin",    label: "Admin" },
      { value: "dealer",   label: "Dealer" },
      { value: "seller",   label: "Seller" },
      { value: "buyer",    label: "Buyer" },
      { value: "user",     label: "User" },
      { value: "collector",label: "Collector" },
    ],
  },
  {
    id: "status", label: "Status", type: "multi",
    options: [
      { value: "active",   label: "Active" },
      { value: "archived", label: "Archived" },
    ],
  },
  {
    id: "kyc", label: "KYC", type: "multi",
    options: [
      { value: "verified",   label: "Verified" },
      { value: "submitted",  label: "Submitted" },
      { value: "unverified", label: "Unverified" },
    ],
  },
  {
    id: "push", label: "Push token", type: "multi",
    options: [
      { value: "on",  label: "Enabled" },
      { value: "off", label: "Disabled" },
    ],
  },
  { id: "joined", label: "Joined", type: "daterange" },
]

// ─── Group options ─────────────────────────────────────────

const GROUP_OPTIONS: GroupOption[] = [
  { id: "role",    label: "Role" },
  { id: "status",  label: "Status" },
  { id: "kyc",     label: "KYC" },
  { id: "country", label: "Country" },
]

// ─── Props ─────────────────────────────────────────────────

type Props = {
  users: UserRow[]
  page: number
  total: number
  pageSize: number
  searchQuery?: string
  pushTokensByUserId?: Record<string, { token: string; platform: string | null }[]>
  view?: string
  viewCounts?: ViewCounts
  hideAdminView?: boolean
}

const BASE = "/admin/users"

// ─── Component ─────────────────────────────────────────────

export function UsersTable({
  users,
  page,
  total,
  pageSize,
  searchQuery = "",
  pushTokensByUserId = {},
  view = "all",
  viewCounts,
  hideAdminView = false,
}: Props) {
  const router = useRouter()

  const enriched = useMemo<UserRowX[]>(
    () =>
      users.map((u) => ({
        ...u,
        _status: derivedStatus(u),
        _kyc: derivedKyc(u),
        _hasPush: (pushTokensByUserId[u.id]?.length ?? 0) > 0,
        _hue: avatarHue(u.id),
      })),
    [users, pushTokensByUserId]
  )

  const views: ViewTab[] = VIEW_IDS
    .filter((id) => !(hideAdminView && id === "admins"))
    .map((id) => ({
      id,
      label: VIEW_LABELS[id],
      count: viewCounts?.[id],
    }))

  function buildViewHref(v: string): string {
    const p = new URLSearchParams()
    if (v !== "all") p.set("view", v)
    if (searchQuery) p.set("search", searchQuery)
    p.set("page", "1")
    const qs = p.toString()
    return qs ? `${BASE}?${qs}` : BASE
  }

  function buildPageHref(pg: number): string {
    const p = new URLSearchParams()
    if (view !== "all") p.set("view", view)
    if (searchQuery) p.set("search", searchQuery)
    p.set("page", String(pg))
    return `${BASE}?${p.toString()}`
  }

  function filterRow(u: UserRowX, filterId: string, selected: string[]): boolean | null {
    if (filterId === "status") return selected.includes(u._status)
    if (filterId === "kyc")    return selected.includes(u._kyc)
    if (filterId === "push")   return selected.includes(u._hasPush ? "on" : "off")
    return null
  }

  function getGroupKey(u: UserRowX, groupBy: string): string | null {
    if (groupBy === "role")    return u.role
    if (groupBy === "status")  return u._status
    if (groupBy === "kyc")     return u._kyc
    if (groupBy === "country") return u.country ?? "—"
    return null
  }

  function getSortValue(u: UserRowX, colId: string): string | number {
    switch (colId) {
      case "user":     return u.name.toLowerCase()
      case "contact":  return u.email.toLowerCase()
      case "role":     return u.role
      case "status":   return u._status
      case "kyc":      return ["verified", "submitted", "unverified"].indexOf(u._kyc)
      case "location": return (u.country ?? "ZZ") + (u.city ?? "")
      case "points":   return u.points
      case "push":     return u._hasPush ? 1 : 0
      case "joined":   return new Date(u.createdAt).getTime()
      default:         return ""
    }
  }

  return (
    <ListViewCard
      rows={enriched}
      columnDefs={COLUMN_DEFS}
      views={views}
      activeView={view}
      buildViewHref={buildViewHref}
      filterDefs={FILTER_DEFS}
      groupOptions={GROUP_OPTIONS}
      defaultSort={{ id: "joined", dir: "desc" }}
      getSortValue={getSortValue}
      filterRow={filterRow}
      getGroupKey={getGroupKey}
      onRowClick={(u) => {
        const p = new URLSearchParams()
        if (view !== "all") p.set("view", view)
        if (searchQuery) p.set("search", searchQuery)
        p.set("page", String(page))
        const qs = p.toString()
        router.push(`${BASE}/${u.id}/edit${qs ? `?${qs}` : ""}`)
      }}
      renderBulkActions={(_rows, onClear) => (
        <>
          <button className="lv-bulkbtn approve" onClick={onClear}>Verify KYC</button>
          <button className="lv-bulkbtn" onClick={onClear}>Grant points</button>
          <button className="lv-bulkbtn" onClick={onClear}>Message</button>
          <button className="lv-bulkbtn danger" onClick={onClear}>Suspend</button>
          <button className="lv-bulkbtn danger" onClick={onClear}>Archive</button>
        </>
      )}
      page={page}
      pageSize={pageSize}
      total={total}
      buildPageHref={buildPageHref}
      onRefresh={() => router.refresh()}
      emptyMessage="No users found."
    />
  )
}
