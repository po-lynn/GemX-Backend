import Link from "next/link"
import { Gem } from "lucide-react"
import { Button } from "@/components/ui/button"

export function HomeNavbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[var(--home-header-bg)]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight text-foreground"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gem className="h-5 w-5" />
          </span>
          <span className="text-lg">GemX</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="/#app"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Download app
          </Link>
          <Link
            href="/#categories"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Categories
          </Link>
          <Link
            href="/#why-us"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Why Us
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Button size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
      
        </div>
      </div>
    </header>
  )
}
