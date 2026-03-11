import { Gem, Sparkles } from "lucide-react"

const LOOSE_STONE_LABELS = ["Ruby", "Sapphire", "Emerald", "Diamond", "Jade", "Spinel", "Tourmaline", "Aquamarine"]
const JEWELLERY_LABELS = ["Ring", "Necklace", "Bracelet", "Earrings", "Pendant", "Bangle", "Accessories"]

export function CategoryShowcase() {
  return (
    <section id="categories" className="border-t border-border py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Shop by category
        </h2>
        <p className="mt-2 text-muted-foreground">
          Loose gemstones and finished jewellery. Browse and filter in the mobile app.
        </p>
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Gem className="h-6 w-6" />
              </span>
              <h3 className="font-heading text-xl font-semibold text-foreground">
                Loose stones
              </h3>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {LOOSE_STONE_LABELS.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </span>
              <h3 className="font-heading text-xl font-semibold text-foreground">
                Jewellery
              </h3>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {JEWELLERY_LABELS.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Download the app to view listings and create your own.
        </p>
      </div>
    </section>
  )
}
