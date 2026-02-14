"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { LayoutDashboard, BookOpen, Package, ReceiptText, FolderTree, FlaskConical, Globe, Gem } from "lucide-react";


type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: (NavItem | NavGroup)[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/credit", label: "Credit", icon: BookOpen },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/categories", label: "Categories", icon: FolderTree },
      { href: "/admin/laboratory", label: "Laboratory", icon: FlaskConical },
      { href: "/admin/origin", label: "Origin", icon: Globe },
    ],
  },
  { href: "/admin/sales", label: "Sales", icon: ReceiptText },
];

export function AdminSidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        // premium look
        "h-full w-72 border-r bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60",
        className
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 px-4 border-b">
        <Link href="/admin" className="flex items-center gap-2">
          <Image
            src="/ds.png"
            alt="Dandelion logo"
            width={55}
            height={55}
            className="rounded-md"
          />
          <span className="font-semibold tracking-tight">GemX Marketplace</span>
        </Link>
        <Badge className="ml-auto rounded-full px-2">Admin</Badge>
      </div>

      {/* Nav */}
      <div className="p-3">
        <div className="text-xs font-medium text-muted-foreground px-2 pb-2">
          Manage
        </div>

        <nav className="space-y-1">
          {navGroups.map((item) => {
            const isActive = (href: string) => {
              if (href === "/admin") return pathname === "/admin";
              return pathname === href || pathname.startsWith(href + "/");
            };

            if ("href" in item) {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition",
                    active
                      ? "bg-accent text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      active
                        ? "text-foreground"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span className="font-medium">{item.label}</span>
                  {active ? (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                  ) : null}
                </Link>
              );
            }

            const group = item;
            return (
              <div key={group.label} className="pt-2 first:pt-0">
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {group.label}
                </div>
                <div className="mt-0.5 space-y-0.5">
                  {group.items.map((it) => {
                    const active = isActive(it.href);
                    const Icon = it.icon;
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        className={cn(
                          "group flex h-9 items-center gap-3 rounded-lg px-3 pl-4 text-sm transition",
                          active
                            ? "bg-accent text-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            active
                              ? "text-foreground"
                              : "text-muted-foreground group-hover:text-foreground"
                          )}
                        />
                        <span className="font-medium">{it.label}</span>
                        {active ? (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Optional footer section */}
        <div className="mt-6 rounded-xl border bg-background p-3">
          <div className="text-xs font-medium text-muted-foreground">Tips</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Use the left menu to manage courses and sales.
          </div>
        </div>
      </div>
    </aside>
  );
}
