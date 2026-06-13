import { db } from "@/drizzle/db"
import { product } from "@/drizzle/schema/product-schema"
import { user } from "@/drizzle/schema/auth-schema"
import { collectorPieceShowRequest } from "@/drizzle/schema/collector-piece-show-request-schema"
import { pointPurchaseRequest } from "@/drizzle/schema/points-schema"
import { count, eq } from "drizzle-orm"
import Link from "next/link"
import {
  Package,
  Users,
  ClipboardList,
  ShoppingBag,
  ArrowUpRight,
  FolderTree,
  Newspaper,
  FileText,
  FlaskConical,
  Globe,
  Eye,
  MessageSquare,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { StaggerList, FadeUp } from "@/components/admin/motion"

async function getStats() {
  const [
    [{ total: totalProducts }],
    [{ total: activeProducts }],
    [{ total: totalUsers }],
    [{ total: pendingCollector }],
    [{ total: pendingPoints }],
  ] = await Promise.all([
    db.select({ total: count() }).from(product),
    db.select({ total: count() }).from(product).where(eq(product.status, "active")),
    db.select({ total: count() }).from(user),
    db.select({ total: count() }).from(collectorPieceShowRequest).where(eq(collectorPieceShowRequest.status, "pending")),
    db.select({ total: count() }).from(pointPurchaseRequest).where(eq(pointPurchaseRequest.status, "pending")),
  ])
  return { totalProducts, activeProducts, totalUsers, pendingCollector, pendingPoints }
}

type QuickAction = {
  href: string
  label: string
  icon: LucideIcon
  color: string
}

const quickActions: QuickAction[] = [
  { href: "/admin/products", label: "Products", icon: Package, color: "#3b82f6" },
  { href: "/admin/categories", label: "Categories", icon: FolderTree, color: "#f97316" },
  { href: "/admin/users", label: "Users", icon: Users, color: "#ec4899" },
  { href: "/admin/news", label: "News", icon: Newspaper, color: "#84cc16" },
  { href: "/admin/articles", label: "Articles", icon: FileText, color: "#64748b" },
  { href: "/admin/laboratory", label: "Laboratory", icon: FlaskConical, color: "#22c55e" },
  { href: "/admin/origin", label: "Origin", icon: Globe, color: "#06b6d4" },
  { href: "/admin/credit", label: "Credit", icon: ShoppingBag, color: "#8b5cf6" },
  { href: "/admin/messages", label: "Messages", icon: MessageSquare, color: "#a855f7" },
  { href: "/admin/collector-piece-show-requests", label: "Collector", icon: Eye, color: "#06b6d4" },
  { href: "/admin/chat-dashboard", label: "Chat", icon: MessageSquare, color: "#0ea5e9" },
]

export default async function AdminPage() {
  const {
    totalProducts,
    activeProducts,
    totalUsers,
    pendingCollector,
    pendingPoints,
  } = await getStats()

  const pendingRequests = pendingCollector

  return (
    <div className="space-y-8 py-2">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Marketplace overview — GemX Admin
        </p>
      </div>

      {/* Stat cards */}
      <StaggerList className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Products */}
        <Link
          href="/admin/products"
          className="group relative overflow-hidden rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/60 transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-violet-100/50 blur-2xl" />
          <div className="relative flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100">
              <Package className="h-5 w-5 text-violet-600" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 transition-all group-hover:text-violet-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
          <div className="relative mt-4">
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {totalProducts.toLocaleString()}
            </div>
            <div className="mt-0.5 text-sm font-medium text-foreground/80">Total Products</div>
            <div className="mt-1.5 text-xs text-muted-foreground">
              {activeProducts.toLocaleString()} active in stock
            </div>
          </div>
        </Link>

        {/* Users */}
        <Link
          href="/admin/users"
          className="group relative overflow-hidden rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/60 transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-blue-100/50 blur-2xl" />
          <div className="relative flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 transition-all group-hover:text-blue-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
          <div className="relative mt-4">
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {totalUsers.toLocaleString()}
            </div>
            <div className="mt-0.5 text-sm font-medium text-foreground/80">Registered Users</div>
            <div className="mt-1.5 text-xs text-muted-foreground">Buyers &amp; sellers</div>
          </div>
        </Link>

        {/* Pending Requests */}
        <Link
          href="/admin/collector-piece-show-requests"
          className={cn(
            "group relative overflow-hidden rounded-2xl bg-card p-5 shadow-sm ring-1 transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
            pendingRequests > 0 ? "ring-amber-300/70" : "ring-border/60"
          )}
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-100/50 blur-2xl" />
          {pendingRequests > 0 && (
            <span className="absolute right-4 top-4 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
          )}
          <div className="relative flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
              <ClipboardList className="h-5 w-5 text-amber-600" />
            </div>
            <ArrowUpRight className="mt-0.5 h-4 w-4 text-muted-foreground/30 transition-all group-hover:text-amber-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
          <div className="relative mt-4">
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {pendingRequests.toLocaleString()}
            </div>
            <div className="mt-0.5 text-sm font-medium text-foreground/80">Pending Requests</div>
            <div className="mt-1.5 text-xs text-muted-foreground">
              {pendingCollector} collector requests
            </div>
          </div>
        </Link>

        {/* Pending Payments */}
        <Link
          href="/admin/credit/purchase-requests"
          className={cn(
            "group relative overflow-hidden rounded-2xl bg-card p-5 shadow-sm ring-1 transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
            pendingPoints > 0 ? "ring-emerald-300/70" : "ring-border/60"
          )}
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-100/50 blur-2xl" />
          {pendingPoints > 0 && (
            <span className="absolute right-4 top-4 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
          )}
          <div className="relative flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
              <ShoppingBag className="h-5 w-5 text-emerald-600" />
            </div>
            <ArrowUpRight className="mt-0.5 h-4 w-4 text-muted-foreground/30 transition-all group-hover:text-emerald-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
          <div className="relative mt-4">
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {pendingPoints.toLocaleString()}
            </div>
            <div className="mt-0.5 text-sm font-medium text-foreground/80">Pending Payments</div>
            <div className="mt-1.5 text-xs text-muted-foreground">Point purchase requests</div>
          </div>
        </Link>
      </StaggerList>

      {/* Quick navigation */}
      <FadeUp delay={0.32}>
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border/60" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Quick Navigation
          </span>
          <div className="h-px flex-1 bg-border/60" />
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-6">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex flex-col items-center gap-2.5 rounded-xl bg-card p-4 text-center shadow-sm ring-1 ring-border/60 transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${action.color}22` }}
              >
                <action.icon className="h-5 w-5" style={{ color: action.color }} />
              </div>
              <span className="text-xs font-medium text-foreground/75 group-hover:text-foreground">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
      </FadeUp>
    </div>
  )
}
