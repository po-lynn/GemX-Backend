"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAdminChatNotifications } from "@/features/chat/context/admin-chat-notification-context";

import {
  LayoutDashboard,
  Package,
  FolderTree,
  Users,
  Eye,
  FlaskConical,
  Globe,
  Newspaper,
  FileText,
  ShieldCheck,
  ShoppingBag,
  ClipboardList,
  MessageSquare,
  Tags,
  Crown,
  Coins,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  color: string;
  isActive?: (pathname: string) => boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: (NavItem | NavGroup)[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    color: "#6366f1",
  },
  {
    label: "Settings",
    items: [
      {
        href: "/admin/credit",
        label: "Point Packages",
        icon: ShoppingBag,
        color: "#8b5cf6",
        isActive: (p) => p === "/admin/credit" || p === "/admin/credit/",
      },
      {
        href: "/admin/credit/purchase-requests",
        label: "Purchase Requests",
        icon: ClipboardList,
        color: "#f59e0b",
        isActive: (p) => p.startsWith("/admin/credit/purchase-requests"),
      },
      {
        href: "/admin/credit/premium-dealer-subscriptions",
        label: "Dealer Subscriptions",
        icon: Crown,
        color: "#f59e0b",
        isActive: (p) => p.startsWith("/admin/credit/premium-dealer-subscriptions"),
      },
      {
        href: "/admin/settings/escrow-service",
        label: "Escrow Service",
        icon: ShieldCheck,
        color: "#ef4444",
        isActive: (p) => p.startsWith("/admin/settings/escrow-service"),
      },
      {
        href: "/admin/settings/rating-tags",
        label: "Seller Rating Tags",
        icon: Tags,
        color: "#f43f5e",
        isActive: (p) => p.startsWith("/admin/settings/rating-tags"),
      },
    ],
  },
  {
    label: "My Account",
    items: [
      {
        href: "/account/points",
        label: "My Points",
        icon: Coins,
        color: "#7c3aed",
        isActive: (p) => p.startsWith("/account/points"),
      },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Package, color: "#3b82f6" },
      {
        href: "/admin/collector-piece-show-requests",
        label: "Collector Requests",
        icon: Eye,
        color: "#06b6d4",
      },
{ href: "/admin/categories", label: "Categories", icon: FolderTree, color: "#f97316" },
      { href: "/admin/messages", label: "Messages", icon: MessageSquare, color: "#a855f7" },
      {
        href: "/admin/chat-dashboard",
        label: "Chat Dashboard",
        icon: MessageSquare,
        color: "#0ea5e9",
      },
      { href: "/admin/users", label: "Users", icon: Users, color: "#ec4899" },
      { href: "/admin/news", label: "News", icon: Newspaper, color: "#84cc16" },
      { href: "/admin/articles", label: "Articles", icon: FileText, color: "#64748b" },
      { href: "/admin/laboratory", label: "Laboratory", icon: FlaskConical, color: "#22c55e" },
      { href: "/admin/origin", label: "Origin", icon: Globe, color: "#06b6d4" },
    ],
  },
];

export function AdminSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { totalUnread } = useAdminChatNotifications();

  function isActive(href: string, custom?: (p: string) => boolean) {
    if (custom) return custom(pathname);
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function renderNavLink(nav: NavItem) {
    const active = isActive(nav.href, nav.isActive);
    const Icon = nav.icon;
    return (
      <Link
        key={nav.href}
        href={nav.href}
        className={cn(
          "group flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-all duration-150",
          active
            ? "text-[var(--admin-sidebar-active)]"
            : "text-[var(--admin-sidebar-muted)] hover:bg-[var(--admin-sidebar-accent)] hover:text-[var(--admin-sidebar-text)]"
        )}
        style={active ? { backgroundColor: "var(--admin-sidebar-accent)" } : undefined}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors"
          style={{ backgroundColor: `${nav.color}22` }}
        >
          <Icon className="h-5 w-5" style={{ color: nav.color }} />
        </span>
        <span className="min-w-0 flex-1 truncate">{nav.label}</span>
        {nav.href === "/admin/chat-dashboard" && totalUnread > 0 ? (
          <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <aside
      className={cn("flex h-full w-72 flex-col border-r", className)}
      style={{
        backgroundColor: "var(--admin-sidebar-bg)",
        borderColor: "var(--admin-sidebar-border)",
      }}
    >
      {/* Brand */}
      <div
        className="flex h-16 shrink-0 items-center gap-3 px-4 border-b"
        style={{ borderColor: "var(--admin-sidebar-border)" }}
      >
        <Link href="/admin" className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative shrink-0">
            <Image
              src="/ds.png"
              alt="Logo"
              width={36}
              height={36}
              className="rounded-lg ring-1 ring-slate-200"
            />
          </div>
          <span
            className="truncate text-[15px] font-semibold tracking-tight"
            style={{ color: "var(--admin-sidebar-text)" }}
          >
            GemX
          </span>
        </Link>
        <Badge
          variant="secondary"
          className="shrink-0 rounded-full border-0 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
          style={{
            backgroundColor: "var(--admin-sidebar-accent)",
            color: "var(--admin-sidebar-active)",
          }}
        >
          Admin
        </Badge>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col overflow-y-auto p-3 pb-4">
        <div className="space-y-0.5">
          {navGroups.map((item) => {
            if ("href" in item) {
              return renderNavLink(item);
            }

            const group = item;
            return (
              <div key={group.label} className="pt-5 first:pt-2">
                <div className="mb-1.5 flex items-center gap-2 px-2">
                  <div
                    className="h-px flex-1"
                    style={{ backgroundColor: "var(--admin-sidebar-border)" }}
                  />
                  <span
                    className="text-xs font-semibold uppercase tracking-[0.08em]"
                    style={{ color: "var(--admin-sidebar-muted)" }}
                  >
                    {group.label}
                  </span>
                  <div
                    className="h-px flex-1"
                    style={{ backgroundColor: "var(--admin-sidebar-border)" }}
                  />
                </div>
                <div className="space-y-0.5">
                  {group.items.map((nav) => renderNavLink(nav))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-6">
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2"
            style={{ backgroundColor: "rgba(100,116,139,0.06)" }}
          >
            <span
              className="text-[11px] font-medium"
              style={{ color: "var(--admin-sidebar-muted)" }}
            >
              GemX Admin
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                backgroundColor: "var(--admin-sidebar-accent)",
                color: "var(--admin-sidebar-active)",
              }}
            >
              v1.0
            </span>
          </div>
        </div>
      </nav>
    </aside>
  );
}
