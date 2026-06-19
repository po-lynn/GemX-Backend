import { db } from "@/drizzle/db"
import { product } from "@/drizzle/schema/product-schema"
import { user } from "@/drizzle/schema/auth-schema"
import { collectorPieceShowRequest } from "@/drizzle/schema/collector-piece-show-request-schema"
import { pointPurchaseRequest } from "@/drizzle/schema/points-schema"
import { count, desc, eq, gte } from "drizzle-orm"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { getUserPermissions } from "@/features/rbac/db/permissions"
import { FEATURE_KEYS, type FeatureKey } from "@/features/rbac/feature-keys"
import { DashboardActivityChart } from "@/components/admin/DashboardActivityChart"
import { DashboardRangePicker } from "@/components/admin/DashboardRangePicker"

async function getStats(since: Date) {
  const [
    [{ total: totalProducts }],
    [{ total: activeProducts }],
    [{ total: totalUsers }],
    [{ total: newProducts }],
    [{ total: newUsers }],
    [{ total: pendingCollector }],
    [{ total: pendingPoints }],
  ] = await Promise.all([
    db.select({ total: count() }).from(product),
    db.select({ total: count() }).from(product).where(eq(product.status, "active")),
    db.select({ total: count() }).from(user),
    db.select({ total: count() }).from(product).where(gte(product.createdAt, since)),
    db.select({ total: count() }).from(user).where(gte(user.createdAt, since)),
    db.select({ total: count() }).from(collectorPieceShowRequest).where(eq(collectorPieceShowRequest.status, "pending")),
    db.select({ total: count() }).from(pointPurchaseRequest).where(eq(pointPurchaseRequest.status, "pending")),
  ])
  return { totalProducts, activeProducts, totalUsers, newProducts, newUsers, pendingCollector, pendingPoints }
}

type ActivityItem = {
  bg: string; stroke: string; iconPath: string; title: string; desc: string; time: string
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

async function getRecentActivity(): Promise<ActivityItem[]> {
  const [recentUsers, recentProducts, recentRequests, recentPayments] = await Promise.all([
    db.select({ name: user.name, createdAt: user.createdAt }).from(user).orderBy(desc(user.createdAt)).limit(3),
    db.select({ title: product.title, createdAt: product.createdAt }).from(product).orderBy(desc(product.createdAt)).limit(3),
    db.select({ createdAt: collectorPieceShowRequest.createdAt }).from(collectorPieceShowRequest).orderBy(desc(collectorPieceShowRequest.createdAt)).limit(3),
    db.select({ points: pointPurchaseRequest.points, packageName: pointPurchaseRequest.packageName, createdAt: pointPurchaseRequest.createdAt }).from(pointPurchaseRequest).orderBy(desc(pointPurchaseRequest.createdAt)).limit(3),
  ])

  const raw: (Omit<ActivityItem, "time"> & { createdAt: Date })[] = [
    ...recentUsers.map(u => ({
      bg: "#e7f0ff", stroke: "#3b7df6",
      iconPath: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M19 8v6 M22 11h-6",
      title: "New user registered",
      desc: u.name || "Anonymous user",
      createdAt: u.createdAt,
    })),
    ...recentProducts.map(p => ({
      bg: "#efeafe", stroke: "#6d5ce7",
      iconPath: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z M3.3 7 12 12l8.7-5 M12 22V12",
      title: "New product listed",
      desc: p.title,
      createdAt: p.createdAt,
    })),
    ...recentRequests.map(r => ({
      bg: "#fef3e2", stroke: "#e08a17",
      iconPath: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z M12 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
      title: "Collector request submitted",
      desc: "Awaiting admin review",
      createdAt: r.createdAt,
    })),
    ...recentPayments.map(p => ({
      bg: "#e7f7ef", stroke: "#0f9d6b",
      iconPath: "M2 5h20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M2 10h20",
      title: "Point purchase request",
      desc: `${p.packageName} · ${p.points.toLocaleString()} pts`,
      createdAt: p.createdAt,
    })),
  ]

  return raw
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
    .map(({ createdAt, ...rest }) => ({ ...rest, time: relativeTime(createdAt) }))
}

type QuickAction = {
  href: string
  label: string
  iconPath: string
  bg: string
  stroke: string
  featureKey?: FeatureKey
  adminOnly?: boolean
}

const quickActions: QuickAction[] = [
  {
    href: "/admin/products", label: "Products",
    iconPath: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z M3.3 7 12 12l8.7-5 M12 22V12",
    bg: "#efeafe", stroke: "#6d5ce7", featureKey: FEATURE_KEYS.PRODUCTS,
  },
  {
    href: "/admin/categories", label: "Categories",
    iconPath: "m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84Z m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65 m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65",
    bg: "#fdeaf3", stroke: "#e0408a", adminOnly: true,
  },
  {
    href: "/admin/users", label: "Users",
    iconPath: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
    bg: "#e7f0ff", stroke: "#3b7df6", featureKey: FEATURE_KEYS.USERS,
  },
  {
    href: "/admin/news", label: "News",
    iconPath: "M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2V11c0-1.1.9-2 2-2h2 M18 14h-8 M15 18h-5 M10 6h8v4h-8V6Z",
    bg: "#e7f7ef", stroke: "#0f9d6b", featureKey: FEATURE_KEYS.NEWS,
  },
  {
    href: "/admin/articles", label: "Articles",
    iconPath: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z M14 2v5h5 M16 13H8 M16 17H8 M10 9H8",
    bg: "#eef0f4", stroke: "#56607a", featureKey: FEATURE_KEYS.ARTICLES,
  },
  {
    href: "/admin/laboratory", label: "Laboratory",
    iconPath: "M10 2v7.31 M14 9.3V2 M8.5 2h7 M14 9.3a6.5 6.5 0 1 1-4 0 M5.52 16h12.96",
    bg: "#e7f7ef", stroke: "#0f9d6b", featureKey: FEATURE_KEYS.LABORATORY,
  },
  {
    href: "/admin/origin", label: "Origin",
    iconPath: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20",
    bg: "#e7f0ff", stroke: "#3b7df6", featureKey: FEATURE_KEYS.ORIGIN,
  },
  {
    href: "/admin/credit", label: "Credit",
    iconPath: "M8 8a6 6 0 1 0 0 12A6 6 0 0 0 8 8z M18.09 10.37A6 6 0 1 1 10.34 18 M7 6h1v4 m16.71 13.88.7.71-2.82 2.82",
    bg: "#efeafe", stroke: "#6d5ce7", featureKey: FEATURE_KEYS.CREDIT_PACKAGES,
  },
  {
    href: "/admin/messages", label: "Messages",
    iconPath: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
    bg: "#fdeaf3", stroke: "#e0408a", featureKey: FEATURE_KEYS.MESSAGES,
  },
  {
    href: "/admin/collector-piece-show-requests", label: "Collector",
    iconPath: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z M12 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    bg: "#fef3e2", stroke: "#e08a17", featureKey: FEATURE_KEYS.COLLECTOR_REQUESTS,
  },
  {
    href: "/admin/chat-dashboard", label: "Chat",
    iconPath: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z",
    bg: "#e7f0ff", stroke: "#3b7df6", featureKey: FEATURE_KEYS.CHAT_DASHBOARD,
  },
  {
    href: "/admin/settings", label: "Settings",
    iconPath: "M21 4H14 M10 4H3 M21 12H12 M8 12H3 M21 20H16 M12 20H3 M14 2v4 M8 10v4 M16 18v4",
    bg: "#eef0f4", stroke: "#56607a", featureKey: FEATURE_KEYS.SETTINGS_ESCROW,
  },
]

// Sparkline paths for each stat card (upward / flat trends)
const SPARKLINES = {
  products: "M0,24 C12,22 18,16 30,18 C42,20 50,8 64,11 C78,14 86,5 100,7 C110,8 116,5 120,3",
  users:    "M0,26 C12,25 18,22 30,21 C42,20 50,15 64,14 C78,13 86,9 100,7 C110,6 116,4 120,2",
  requests: "M0,20 C12,21 18,22 30,21 C42,20 50,22 64,21 C78,20 86,18 100,15 C110,13 116,16 120,14",
  payments: "M0,22 C12,22 18,21 30,21 C42,21 50,22 64,22 C78,22 86,21 100,21 C110,21 116,22 120,22",
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { range = "7d" } = await searchParams
  const days = range === "90d" ? 90 : range === "30d" ? 30 : 7
  const since = new Date()
  since.setDate(since.getDate() - days)

  const session = await auth.api.getSession({ headers: await headers() })
  const role = session?.user.role ?? "user"
  const userId = session?.user.id ?? ""
  const permissions = role === "internal" && userId ? await getUserPermissions(userId) : {}

  function canSee(item: { featureKey?: FeatureKey; adminOnly?: boolean }): boolean {
    if (role === "admin") return true
    if (item.adminOnly) return false
    if (!item.featureKey) return true
    return permissions[item.featureKey] ?? false
  }

  const [{ totalProducts, activeProducts, totalUsers, newProducts, newUsers, pendingCollector, pendingPoints }, recentActivity] =
    await Promise.all([getStats(since), getRecentActivity()])

  const showProducts  = canSee({ featureKey: FEATURE_KEYS.PRODUCTS })
  const showUsers     = canSee({ featureKey: FEATURE_KEYS.USERS })
  const showCollector = canSee({ featureKey: FEATURE_KEYS.COLLECTOR_REQUESTS })
  const showPayments  = canSee({ featureKey: FEATURE_KEYS.CREDIT_PURCHASE_REQUESTS })

  const visibleActions = quickActions.filter(canSee)

  const ACCENT = "#6d5ce7"

  return (
    <div>
      {/* ── Page title row ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", color: "#191525" }}>Dashboard</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#8a8799" }}>Marketplace overview — GemX Admin</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <DashboardRangePicker current={range} />
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, marginBottom: 20 }}>

        {/* Products */}
        {showProducts && (
          <Link href="/admin/products" style={{ textDecoration: "none" }}>
            <div style={{ background: "#fff", border: "1px solid #ededf2", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(20,15,40,0.04)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: "#efeafe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6d5ce7" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
                  </svg>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "#0f9d6b", background: "#e7f7ef", padding: "4px 9px", borderRadius: 20 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                  8%
                </span>
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: "#191525", marginTop: 18, lineHeight: 1 }}>{totalProducts}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#191525", marginTop: 10 }}>Total Products</div>
              <div style={{ fontSize: 12.5, color: "#8a8799", marginTop: 2 }}>{activeProducts} active · +{newProducts} in {days}d</div>
              <svg width="100%" height="30" viewBox="0 0 120 30" preserveAspectRatio="none" style={{ marginTop: 14, display: "block", overflow: "visible" }}>
                <path d={SPARKLINES.products} fill="none" stroke="#6d5ce7" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          </Link>
        )}

        {/* Users */}
        {showUsers && (
          <Link href="/admin/users" style={{ textDecoration: "none" }}>
            <div style={{ background: "#fff", border: "1px solid #ededf2", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(20,15,40,0.04)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: "#e7f0ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b7df6" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "#0f9d6b", background: "#e7f7ef", padding: "4px 9px", borderRadius: 20 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                  12%
                </span>
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: "#191525", marginTop: 18, lineHeight: 1 }}>{totalUsers}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#191525", marginTop: 10 }}>Registered Users</div>
              <div style={{ fontSize: 12.5, color: "#8a8799", marginTop: 2 }}>+{newUsers} new in {days}d</div>
              <svg width="100%" height="30" viewBox="0 0 120 30" preserveAspectRatio="none" style={{ marginTop: 14, display: "block", overflow: "visible" }}>
                <path d={SPARKLINES.users} fill="none" stroke="#3b7df6" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          </Link>
        )}

        {/* Pending Requests */}
        {showCollector && (
          <Link href="/admin/collector-piece-show-requests" style={{ textDecoration: "none" }}>
            <div style={{ background: "#fff", border: "1px solid #ededf2", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(20,15,40,0.04)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: "#fef3e2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e08a17" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>
                  </svg>
                </div>
                {pendingCollector > 0
                  ? <span style={{ fontSize: 12, fontWeight: 700, color: "#e08a17", background: "#fef3e2", padding: "4px 9px", borderRadius: 20 }}>Needs review</span>
                  : <span style={{ fontSize: 12, fontWeight: 700, color: "#8a8799", background: "#f1f1f5", padding: "4px 9px", borderRadius: 20 }}>All clear</span>
                }
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: "#191525", marginTop: 18, lineHeight: 1 }}>{pendingCollector}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#191525", marginTop: 10 }}>Pending Requests</div>
              <div style={{ fontSize: 12.5, color: "#8a8799", marginTop: 2 }}>{pendingCollector} collector request{pendingCollector !== 1 ? "s" : ""}</div>
              <svg width="100%" height="30" viewBox="0 0 120 30" preserveAspectRatio="none" style={{ marginTop: 14, display: "block", overflow: "visible" }}>
                <path d={SPARKLINES.requests} fill="none" stroke="#e08a17" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          </Link>
        )}

        {/* Pending Payments */}
        {showPayments && (
          <Link href="/admin/credit/purchase-requests" style={{ textDecoration: "none" }}>
            <div style={{ background: "#fff", border: "1px solid #ededf2", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(20,15,40,0.04)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: "#e7f7ef", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0f9d6b" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
                  </svg>
                </div>
                {pendingPoints > 0
                  ? <span style={{ fontSize: 12, fontWeight: 700, color: "#e08a17", background: "#fef3e2", padding: "4px 9px", borderRadius: 20 }}>Needs review</span>
                  : <span style={{ fontSize: 12, fontWeight: 700, color: "#8a8799", background: "#f1f1f5", padding: "4px 9px", borderRadius: 20 }}>All clear</span>
                }
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: "#191525", marginTop: 18, lineHeight: 1 }}>{pendingPoints}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#191525", marginTop: 10 }}>Pending Payments</div>
              <div style={{ fontSize: 12.5, color: "#8a8799", marginTop: 2 }}>Point purchase requests</div>
              <svg width="100%" height="30" viewBox="0 0 120 30" preserveAspectRatio="none" style={{ marginTop: 14, display: "block", overflow: "visible" }}>
                <path d={SPARKLINES.payments} fill="none" stroke="#cdccd6" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          </Link>
        )}
      </div>

      {/* ── Chart + Donut row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, marginBottom: 20 }}>

        <DashboardActivityChart />

        {/* User Base donut */}
        <div style={{ background: "#fff", border: "1px solid #ededf2", borderRadius: 16, padding: 22, boxShadow: "0 1px 3px rgba(20,15,40,0.04)" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#191525" }}>User Base</div>
          <div style={{ fontSize: 12.5, color: "#8a8799", marginTop: 3 }}>Composition of {totalUsers} members</div>
          <div style={{ display: "flex", justifyContent: "center", margin: "14px 0 8px" }}>
            <svg width="170" height="170" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="54" fill="none" stroke="#f1f0f6" strokeWidth="16"/>
              <circle cx="70" cy="70" r="54" fill="none" stroke={ACCENT} strokeWidth="16" strokeLinecap="round"
                strokeDasharray={`${(339.3 * 0.65).toFixed(1)} 339.3`} transform="rotate(-90 70 70)"/>
              <circle cx="70" cy="70" r="54" fill="none" stroke="#b9aef9" strokeWidth="16" strokeLinecap="round"
                strokeDasharray={`${(339.3 * 0.33).toFixed(1)} 339.3`} strokeDashoffset="-223" transform="rotate(-90 70 70)"/>
              <text x="70" y="66" textAnchor="middle" fontSize="30" fontWeight="800" fill="#191525" fontFamily="inherit">{totalUsers}</text>
              <text x="70" y="86" textAnchor="middle" fontSize="12" fontWeight="600" fill="#9b98ab" fontFamily="inherit">Total users</text>
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, fontWeight: 600, color: "#56536a" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: ACCENT, display: "inline-block" }}/>
                Buyers
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#191525" }}>{Math.round(totalUsers * 0.65)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, fontWeight: 600, color: "#56536a" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "#b9aef9", display: "inline-block" }}/>
                Sellers
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#191525" }}>{Math.round(totalUsers * 0.35)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Activity + Attention row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, marginBottom: 24 }}>

        {/* Recent Activity */}
        <div style={{ background: "#fff", border: "1px solid #ededf2", borderRadius: 16, padding: 22, boxShadow: "0 1px 3px rgba(20,15,40,0.04)" }}>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#191525" }}>Recent Activity</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {recentActivity.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 13,
                  padding: "13px 0",
                  borderBottom: i < recentActivity.length - 1 ? "1px solid #f3f2f7" : undefined,
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={item.stroke} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    {item.iconPath.split(" M").map((part, pi) => (
                      <path key={pi} d={pi === 0 ? part : "M" + part}/>
                    ))}
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#191525" }}>{item.title}</div>
                  <div style={{ fontSize: 12.5, color: "#8a8799", marginTop: 1 }}>{item.desc}</div>
                </div>
                <span style={{ fontSize: 12, color: "#a6a3b8", fontWeight: 500, flexShrink: 0 }}>{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Needs Your Attention */}
        <div style={{ background: "#fff", border: "1px solid #ededf2", borderRadius: 16, padding: 22, boxShadow: "0 1px 3px rgba(20,15,40,0.04)", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#191525" }}>Needs Your Attention</div>
          <div style={{ fontSize: 12.5, color: "#8a8799", marginTop: 3, marginBottom: 16 }}>Items awaiting an action</div>

          {/* Collector Requests */}
          <div style={{ border: `1px solid ${pendingCollector > 0 ? "#f6e6c8" : "#e7f0e9"}`, background: pendingCollector > 0 ? "#fffbf3" : "#f7fcf9", borderRadius: 13, padding: 15, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: pendingCollector > 0 ? "#fef3e2" : "#e7f7ef", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {pendingCollector > 0 ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e08a17" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f9d6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#191525" }}>{pendingCollector} Collector Request{pendingCollector !== 1 ? "s" : ""}</div>
                <div style={{ fontSize: 12, color: "#8a8799", marginTop: 1 }}>{pendingCollector > 0 ? "Pending verification" : "No pending requests"}</div>
              </div>
            </div>
            {pendingCollector > 0 && (
              <Link
                href="/admin/collector-piece-show-requests"
                style={{ display: "block", width: "100%", marginTop: 13, background: "#e08a17", border: "none", borderRadius: 9, padding: 9, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", textAlign: "center", textDecoration: "none" }}
              >
                Review request
              </Link>
            )}
          </div>

          {/* Pending Payments */}
          <div style={{ border: "1px solid #e7f0e9", background: "#f7fcf9", borderRadius: 13, padding: 15 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: pendingPoints > 0 ? "#fef3e2" : "#e7f7ef", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {pendingPoints > 0 ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e08a17" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f9d6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#191525" }}>{pendingPoints} Pending Payment{pendingPoints !== 1 ? "s" : ""}</div>
                <div style={{ fontSize: 12, color: "#8a8799", marginTop: 1 }}>{pendingPoints > 0 ? "Awaiting approval" : "All point purchases settled"}</div>
              </div>
            </div>
            {pendingPoints > 0 && (
              <Link
                href="/admin/credit/purchase-requests"
                style={{ display: "block", width: "100%", marginTop: 13, background: "#e08a17", border: "none", borderRadius: 9, padding: 9, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", textAlign: "center", textDecoration: "none" }}
              >
                Review payments
              </Link>
            )}
          </div>

          <div style={{ flex: 1 }}/>
          <Link href="/admin/collector-piece-show-requests" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16, fontSize: 13, fontWeight: 600, color: ACCENT, textDecoration: "none" }}>
            Go to requests
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>
      </div>

      {/* ── Quick Navigation ── */}
      {visibleActions.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", color: "#a6a3b8", textTransform: "uppercase" }}>Quick Navigation</span>
            <div style={{ flex: 1, height: 1, background: "#ededf2" }}/>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16 }}>
            {visibleActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                style={{ background: "#fff", border: "1px solid #ededf2", borderRadius: 14, padding: "20px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 11, textDecoration: "none" }}
              >
                <div style={{ width: 46, height: 46, borderRadius: 13, background: action.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={action.stroke} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    {action.iconPath.split(" M").map((part, pi) => (
                      <path key={pi} d={pi === 0 ? part : "M" + part}/>
                    ))}
                  </svg>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "#191525" }}>{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
