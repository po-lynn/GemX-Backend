"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, useCallback } from "react";
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
  ClipboardList,
  MessageSquare,
  MessageCircle,
  Tags,
  ShieldAlert,
  Crown,
  Coins,
  ShoppingBag,
  Settings2,
  SlidersHorizontal,
  ChevronDown,
  Palette,
} from "lucide-react";
import { FEATURE_KEYS, type FeatureKey } from "@/features/rbac/feature-keys";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  color: string;
  isActive?: (pathname: string) => boolean;
  featureKey?: FeatureKey;
  adminOnly?: boolean;
};

type NavSubMenu = {
  label: string;
  icon: React.ElementType;
  color: string;
  children: NavItem[];
};

type NavGroup = {
  label: string;
  items: (NavItem | NavSubMenu)[];
};

const navGroups: (NavItem | NavGroup)[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    color: "#8b5cf6",
  },
  {
    label: "Master Data",
    items: [
      { href: "/admin/products",   label: "Products",    icon: Package,      color: "#3b82f6", featureKey: FEATURE_KEYS.PRODUCTS },
      {
        label: "Configuration",
        icon: SlidersHorizontal,
        color: "#6366f1",
        children: [
          { href: "/admin/categories", label: "Category",    icon: FolderTree,   color: "#f59e0b", adminOnly: true },
          { href: "/admin/laboratory", label: "Laboratory",  icon: FlaskConical, color: "#22c55e", featureKey: FEATURE_KEYS.LABORATORY },
          { href: "/admin/origin",     label: "Origin",      icon: Globe,        color: "#14b8a6", featureKey: FEATURE_KEYS.ORIGIN },
          { href: "/admin/colors",     label: "Color",       icon: Palette,      color: "#ec4899", featureKey: FEATURE_KEYS.COLOR },
          {
            href: "/admin/settings/rating-tags",
            label: "Seller Rating Tags",
            icon: Tags,
            color: "#ef4444",
            featureKey: FEATURE_KEYS.SETTINGS_RATING_TAGS,
            isActive: (p) => p.startsWith("/admin/settings/rating-tags"),
          },
          {
            href: "/admin/settings/precaution-tags",
            label: "Precaution Tags",
            icon: ShieldAlert,
            color: "#f59e0b",
            featureKey: FEATURE_KEYS.SETTINGS_PRECAUTION_TAGS,
            isActive: (p) => p.startsWith("/admin/settings/precaution-tags"),
          },
        ],
      },
    ],
  },
  {
    label: "Requests",
    items: [
      {
        href: "/admin/credit/purchase-requests",
        label: "Payment Transactions",
        icon: ClipboardList,
        color: "#f59e0b",
        featureKey: FEATURE_KEYS.CREDIT_PURCHASE_REQUESTS,
        isActive: (p) => p.startsWith("/admin/credit/purchase-requests"),
      },
      {
        href: "/admin/collector-piece-show-requests",
        label: "Collector Requests",
        icon: Eye,
        color: "#8b5cf6",
        featureKey: FEATURE_KEYS.COLLECTOR_REQUESTS,
      },
    ],
  },
  {
    label: "Transactions",
    items: [
      {
        href: "/admin/credit/premium-dealer-subscriptions",
        label: "Dealer Subscriptions",
        icon: Crown,
        color: "#eab308",
        featureKey: FEATURE_KEYS.CREDIT_SUBSCRIPTIONS,
        isActive: (p) => p.startsWith("/admin/credit/premium-dealer-subscriptions"),
      },
      {
        href: "/admin/credit/transactions",
        label: "Point Transactions",
        icon: Coins,
        color: "#8b5cf6",
        featureKey: FEATURE_KEYS.CREDIT_TRANSACTIONS,
        isActive: (p) => p.startsWith("/admin/credit/transactions"),
      },
    ],
  },
  {
    label: "Communication",
    items: [
      { href: "/admin/messages",       label: "Messages",       icon: MessageSquare, color: "#d946ef", featureKey: FEATURE_KEYS.MESSAGES },
      { href: "/admin/chat-dashboard", label: "Chat Dashboard", icon: MessageCircle, color: "#0ea5e9", featureKey: FEATURE_KEYS.CHAT_DASHBOARD },
      { href: "/admin/users",          label: "Users",          icon: Users,         color: "#ec4899", featureKey: FEATURE_KEYS.USERS },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/news",     label: "News",     icon: Newspaper, color: "#22c55e", featureKey: FEATURE_KEYS.NEWS },
      { href: "/admin/articles", label: "Articles", icon: FileText,  color: "#64748b", featureKey: FEATURE_KEYS.ARTICLES },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        href: "/admin/credit",
        label: "Point Packages",
        icon: ShoppingBag,
        color: "#8b5cf6",
        featureKey: FEATURE_KEYS.CREDIT_PACKAGES,
        isActive: (p) => p === "/admin/credit" || p === "/admin/credit/",
      },
      {
        href: "/admin/settings",
        label: "Settings",
        icon: Settings2,
        color: "#7c5cff",
        featureKey: FEATURE_KEYS.SETTINGS_ESCROW,
        isActive: (p) => p === "/admin/settings" || p.startsWith("/admin/settings?"),
      },
    ],
  },
];

type Props = {
  className?: string;
  role: string;
  permissions: Record<string, boolean>;
};

const STORAGE_KEY = "admin-sidebar-collapsed-groups";

// Module-level mini-store so useSyncExternalStore can subscribe to it
const storeListeners = new Set<() => void>();
let storeSnapshot = "[]";
let storeInitialized = false;

function subscribeStore(listener: () => void) {
  storeListeners.add(listener);
  return () => { storeListeners.delete(listener); };
}

function getSnapshot() {
  if (!storeInitialized) {
    storeInitialized = true;
    try { storeSnapshot = localStorage.getItem(STORAGE_KEY) ?? "[]"; } catch {}
  }
  return storeSnapshot;
}

function getServerSnapshot() { return "[]"; }

function writeStore(groups: Set<string>) {
  storeSnapshot = JSON.stringify([...groups]);
  try { localStorage.setItem(STORAGE_KEY, storeSnapshot); } catch {}
  storeListeners.forEach((l) => l());
}

export function AdminSidebar({ className, role, permissions }: Props) {
  const pathname = usePathname();
  const { totalUnread } = useAdminChatNotifications();
  const raw = useSyncExternalStore(subscribeStore, getSnapshot, getServerSnapshot);
  const collapsed = new Set<string>(JSON.parse(raw) as string[]);

  const toggleGroup = useCallback((label: string) => {
    const next = new Set<string>(JSON.parse(storeSnapshot) as string[]);
    if (next.has(label)) next.delete(label); else next.add(label);
    writeStore(next);
  }, []);

  function canSee(item: NavItem): boolean {
    if (role === "admin") return true;
    if (item.adminOnly) return false;
    if (!item.featureKey) return true;
    return permissions[item.featureKey] ?? false;
  }

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
          "flex w-full items-center gap-3 rounded-[11px] px-[11px] py-[10px] text-[14.5px] font-semibold transition-colors duration-150",
          active
            ? "text-[var(--admin-sidebar-active)]"
            : "text-[#444b5c] hover:bg-[var(--admin-sidebar-accent-hover)]"
        )}
        style={active ? { backgroundColor: "var(--admin-sidebar-accent)" } : undefined}
      >
        <Icon
          className="h-[21px] w-[21px] shrink-0"
          style={{ color: active ? "var(--admin-sidebar-active)" : nav.color }}
          strokeWidth={1.8}
        />
        <span className="min-w-0 flex-1 truncate">{nav.label}</span>
        {nav.href === "/admin/chat-dashboard" && totalUnread > 0 ? (
          <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        ) : null}
      </Link>
    );
  }

  function renderSubMenu(sub: NavSubMenu, visibleChildren: NavItem[]) {
    // Store key is prefixed so a sub-menu never collides with a group label.
    // Inverted semantics vs groups: presence in the store means OPEN, so
    // sub-menus default to collapsed.
    const storeKey = `submenu:${sub.label}`;
    const childActive = visibleChildren.some((c) => isActive(c.href, c.isActive));
    const isOpen = collapsed.has(storeKey);
    const Icon = sub.icon;
    return (
      <div key={sub.label}>
        <button
          onClick={() => toggleGroup(storeKey)}
          aria-expanded={isOpen}
          className={cn(
            "flex w-full cursor-pointer items-center gap-3 rounded-[11px] px-[11px] py-[10px] text-[14.5px] font-semibold transition-colors duration-150",
            childActive
              ? "text-[var(--admin-sidebar-active)]"
              : "text-[#444b5c] hover:bg-[var(--admin-sidebar-accent-hover)]"
          )}
        >
          <Icon
            className="h-[21px] w-[21px] shrink-0"
            style={{ color: childActive ? "var(--admin-sidebar-active)" : sub.color }}
            strokeWidth={1.8}
          />
          <span className="min-w-0 flex-1 truncate text-left">{sub.label}</span>
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 transition-transform duration-200"
            style={{
              color: "var(--admin-sidebar-muted)",
              transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
            }}
          />
        </button>
        {isOpen && (
          <div
            className="ml-[21px] space-y-0.5 border-l pl-2"
            style={{ borderColor: "var(--admin-sidebar-border)" }}
          >
            {visibleChildren.map((nav) => renderNavLink(nav))}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside
      className={cn("flex h-full flex-col border-r", className)}
      style={{
        width: "264px",
        flexBasis: "264px",
        flexShrink: 0,
        backgroundColor: "var(--admin-sidebar-bg)",
        borderColor: "var(--admin-sidebar-border)",
      }}
    >
      {/* Brand */}
      <div
        className="flex shrink-0 items-center gap-[11px] px-5 pb-4 pt-5"
        style={{ borderBottom: "1px solid var(--admin-sidebar-border)" }}
      >
        <Link href="/admin" className="flex min-w-0 flex-1 items-center gap-[11px]">
          <div
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl"
            style={{ border: "1.5px solid #ece8fb" }}
          >
            <Image src="/ds.png" alt="GemX" width={24} height={24} className="rounded-md" />
          </div>
          <span
            className="text-[19px] font-extrabold tracking-[-0.01em]"
            style={{ color: "var(--admin-sidebar-text)" }}
          >
            GemX
          </span>
        </Link>
        <Badge
          variant="secondary"
          className="shrink-0 rounded-full border-0 px-[9px] py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
          style={{
            backgroundColor: "var(--admin-sidebar-accent)",
            color: "var(--admin-sidebar-active)",
          }}
        >
          Admin
        </Badge>
      </div>

      {/* Nav scroll area */}
      <nav
        className="flex flex-1 flex-col overflow-y-auto px-3 pb-3.5 pt-1.5"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#d7dae2 transparent" }}
      >
        <div className="space-y-0">
          {navGroups.map((item) => {
            if ("href" in item) {
              return (
                <div key={item.href} className="mt-0.5">
                  {renderNavLink(item)}
                </div>
              );
            }

            const visibleItems = item.items.filter((it) =>
              "children" in it ? it.children.some(canSee) : canSee(it)
            );
            if (visibleItems.length === 0) return null;

            const isCollapsed = collapsed.has(item.label);
            return (
              <div key={item.label} className="mt-3.5">
                {/* Group label with collapse toggle */}
                <button
                  onClick={() => toggleGroup(item.label)}
                  className="mb-2 flex w-full cursor-pointer items-center gap-[10px] rounded-md px-2.5 pb-2 pt-1.5 hover:opacity-70"
                  aria-expanded={!isCollapsed}
                >
                  <span
                    className="whitespace-nowrap text-[10.5px] font-bold uppercase"
                    style={{
                      letterSpacing: "0.11em",
                      color: "var(--admin-sidebar-muted)",
                    }}
                  >
                    {item.label}
                  </span>
                  <div
                    className="h-px flex-1"
                    style={{ backgroundColor: "var(--admin-sidebar-border)" }}
                  />
                  <ChevronDown
                    className="h-3 w-3 shrink-0 transition-transform duration-200"
                    style={{
                      color: "var(--admin-sidebar-muted)",
                      transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                    }}
                  />
                </button>
                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {visibleItems.map((nav) =>
                      "children" in nav
                        ? renderSubMenu(nav, nav.children.filter(canSee))
                        : renderNavLink(nav)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="mt-auto flex items-center justify-between px-[18px] py-[13px]"
          style={{ borderTop: "1px solid var(--admin-sidebar-border)" }}
        >
          <span className="text-[14px] font-bold" style={{ color: "var(--admin-sidebar-text)" }}>
            Admin
          </span>
          <span
            className="rounded-full px-[9px] py-1 text-[11px] font-bold"
            style={{
              backgroundColor: "var(--admin-sidebar-accent)",
              color: "var(--admin-sidebar-active)",
            }}
          >
            v1.0
          </span>
        </div>
      </nav>
    </aside>
  );
}
