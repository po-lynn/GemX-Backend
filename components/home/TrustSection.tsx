import { Shield, FileCheck, Gem, Award } from "lucide-react"

const items = [
  {
    icon: FileCheck,
    title: "Lab reports",
    description: "Certified stones with GIA, GRS, and trusted lab documentation when available.",
  },
  {
    icon: Shield,
    title: "Verified sellers",
    description: "Transparent profiles and moderation so you buy with confidence.",
  },
  {
    icon: Gem,
    title: "Curated quality",
    description: "From collector pieces to everyday jewellery, each listing is vetted.",
  },
  {
    icon: Award,
    title: "Premium assist",
    description: "Optional white-glove service for high-value and special requests.",
  },
]

export function TrustSection() {
  return (
    <section id="why-us" className="border-t border-border bg-muted/20 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Why GemX
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          A marketplace built for trust: certified gemstones, clear documentation, and sellers who care about the same standards you do.
        </p>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <item.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
