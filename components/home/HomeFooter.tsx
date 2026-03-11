import Link from "next/link"
import { Gem } from "lucide-react"

export function HomeFooter() {
  return (
    <footer className="border-t border-border bg-[var(--home-footer-bg)]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
          <Link href="/" className="flex items-center gap-2 text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Gem className="h-4 w-4" />
            </span>
            <span className="font-semibold">GemX</span>
          </Link>
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <Link href="/#app" className="transition-colors hover:text-foreground">
              Download app
            </Link>
            <Link href="/#categories" className="transition-colors hover:text-foreground">
              Categories
            </Link>
            <Link href="/#why-us" className="transition-colors hover:text-foreground">
              Why Us
            </Link>
            <Link href="/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Link href="/admin" className="transition-colors hover:text-foreground">
              Admin
            </Link>
          </nav>
        </div>
        <div className="mt-8 border-t border-border pt-8 text-center text-sm text-muted-foreground">
          <p>© 2026 GemX. Premium gemstone & jewellery marketplace.</p>
        </div>
      </div>
    </footer>
  )
}
