"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  LayoutDashboard,
  BookOpen,
  Package,
  FolderTree,
  Users,
  FlaskConical,
  Globe,
  Newspaper,
  FileText,
  Sparkles,
  BadgeCheck,
  HandCoins,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  /** When set, use instead of default prefix match (e.g. Credit vs Credit subpages). */
  isActive?: (pathname: string) => boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: (NavItem | NavGroup)[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  {
    label: "Settings",
    items: [
      {
        href: "/admin/credit",
        label: "Point Management",
        icon: BookOpen,
        isActive: (p) => p === "/admin/credit" || p === "/admin/credit/",
      },
      {
        href: "/admin/credit/feature-settings",
        label: "Feature Settings",
        icon: BadgeCheck,
        isActive: (p) =>
          p === "/admin/credit/feature-settings" ||
          p === "/admin/credit/feature-settings/",
      },
      {
        href: "/admin/credit/feature-settings/escrow",
        label: "Escrow Service Settings",
        icon: HandCoins,
        isActive: (p) => p.startsWith("/admin/credit/feature-settings/escrow"),
      },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/categories", label: "Categories", icon: FolderTree },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/news", label: "News", icon: Newspaper },
      { href: "/admin/articles", label: "Articles", icon: FileText },
      { href: "/admin/laboratory", label: "Laboratory", icon: FlaskConical },
      { href: "/admin/origin", label: "Origin", icon: Globe },
    ],
  },
];

export function AdminSidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn("h-full w-72 border-r", className)}
      style={{
        backgroundColor: "var(--admin-sidebar-bg)",
        borderColor: "var(--admin-sidebar-border)",
      }}
    >
      {/* Brand */}
      <div
        className="flex h-16 items-center gap-3 px-4 border-b"
        style={{ borderColor: "var(--admin-sidebar-border)" }}
      >
        <Link href="/admin" className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative shrink-0">
            <Image
              src="/ds.png"
              alt="Logo"
              width={40}
              height={40}
              className="rounded-lg ring-1 ring-white/10"
            />
          </div>
          <span
            className="truncate font-semibold tracking-tight"
            style={{ color: "var(--admin-sidebar-text)" }}
          >
            GemX
          </span>
        </Link>
        <Badge
          variant="secondary"
          className="shrink-0 rounded-full border-0 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
          style={{
            backgroundColor: "var(--admin-sidebar-accent)",
            color: "var(--admin-sidebar-active)",
          }}
        >
          Admin
        </Badge>
      </div>

      {/* Nav */}
      <div className="flex flex-1 flex-col overflow-y-auto p-3">
        <div
          className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--admin-sidebar-muted)" }}
        >
          Manage
        </div>

        <nav className="space-y-0.5">
          {navGroups.map((item) => {
            const defaultIsActive = (href: string, custom?: (p: string) => boolean) => {
              if (custom) return custom(pathname);
              if (href === "/admin") return pathname === "/admin";
              return pathname === href || pathname.startsWith(href + "/");
            };

            if ("href" in item) {
              const active = defaultIsActive(item.href, item.isActive);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex h-10 items-center gap-3 rounded-lg border-l-4 border-transparent px-3 text-sm transition-all duration-200",
                    "hover:bg-[var(--admin-sidebar-accent)] hover:text-[var(--admin-sidebar-text)]",
                    active
                      ? "border-l-[var(--admin-sidebar-active)] bg-[var(--admin-sidebar-accent)] pl-[11px] text-[var(--admin-sidebar-active)]"
                      : "text-[var(--admin-sidebar-muted)]"
                  )}
                >
                  <Icon
                    className={cn("h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-80 group-hover:opacity-100")}
                    style={{ color: active ? "var(--admin-sidebar-active)" : "inherit" }}
                  />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            }

            const group = item;
            return (
              <div key={group.label} className="pt-3 first:pt-0">
                <div
                  className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--admin-sidebar-muted)" }}
                >
                  {group.label}
                </div>
                <div className="mt-1 space-y-0.5">
                  {group.items.map((nav) => {
                    const active = defaultIsActive(nav.href, nav.isActive);
                    const Icon = nav.icon;
                    const padLeft = active ? "pl-3" : "pl-4";
                    return (
                      <Link
                        key={nav.href}
                        href={nav.href}
                        className={cn(
                          "group flex h-9 items-center gap-3 rounded-lg border-l-4 border-transparent pr-3 text-sm transition-all duration-200",
                          padLeft,
                          "hover:bg-[var(--admin-sidebar-accent)] hover:text-[var(--admin-sidebar-text)]",
                          active
                            ? "border-l-[var(--admin-sidebar-active)] bg-[var(--admin-sidebar-accent)] text-[var(--admin-sidebar-active)]"
                            : "text-[var(--admin-sidebar-muted)]"
                        )}
                      >
                        <Icon
                          className={cn("h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-80 group-hover:opacity-100")}
                          style={{ color: active ? "var(--admin-sidebar-active)" : "inherit" }}
                        />
                        <span className="font-medium">{nav.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Tips card */}
        <div
          className="mt-6 rounded-xl border p-3"
          style={{
            backgroundColor: "rgba(255,255,255,0.04)",
            borderColor: "var(--admin-sidebar-border)",
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--admin-sidebar-active)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--admin-sidebar-text)" }}>
              Tips
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--admin-sidebar-muted)" }}>
            Use the menu to manage products, news, and articles.
          </p>
        </div>
      </div>
    </aside>
  );
}
