"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LayoutDashboard, BookOpen, Package, ReceiptText } from "lucide-react";

type Item = {
  href: string;
  label: string;
  icon: React.ElementType;
};

const items: Item[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/courses", label: "Courses", icon: BookOpen },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/sales", label: "Sales", icon: ReceiptText },
];

export function AdminSidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        // premium look
        "h-full w-72 border-r bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 px-4 border-b">
        <Link href="/admin" className="flex items-center gap-2">
          <Image
            src="/ds.png"
            alt="Dandelion logo"
            width={22}
            height={22}
            className="rounded-md"
          />
          <span className="font-semibold tracking-tight">Dandelion</span>
        </Link>
        <Badge className="ml-auto rounded-full px-2">Admin</Badge>
      </div>

      {/* Nav */}
      <div className="p-3">
        <div className="text-xs font-medium text-muted-foreground px-2 pb-2">
          Manage
        </div>

        <nav className="space-y-1">
          {items.map((it) => {
            const isActive = (href: string) => {
              if (href === "/admin") return pathname === "/admin";
              return pathname === href || pathname.startsWith(href + "/");
            };

            const active = isActive(it.href);
            const Icon = it.icon;

            return (
              <Link
                key={it.href}
                href={it.href}
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
                <span className="font-medium">{it.label}</span>

                {/* subtle active indicator */}
                {active ? (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                ) : null}
              </Link>
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
