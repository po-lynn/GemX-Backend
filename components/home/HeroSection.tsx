import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden px-4 pt-24 pb-16 sm:px-6 lg:px-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, var(--primary) / 0.2), radial-gradient(ellipse 60% 40% at 80% 50%, var(--primary) / 0.08)",
        }}
      />
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" />
          Certified gemstones & fine jewellery
        </p>
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
          Where rarity
          <br />
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            meets trust
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Discover certified loose gemstones and handcrafted jewellery. Lab reports, transparent sellers, and a marketplace built for collectors and enthusiasts.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" className="gap-2 rounded-full px-8 text-base" asChild>
            <Link href="/#app">Download mobile app</Link>
          </Button>
          <Button size="lg" variant="outline" className="rounded-full px-8 text-base" asChild>
            <Link href="/#categories">Browse categories</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
