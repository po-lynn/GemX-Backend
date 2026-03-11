import { Smartphone, Store, Eye, PlusCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function MobileAppSection() {
  return (
    <section id="app" className="border-t border-border bg-muted/20 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl text-center lg:text-left">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Smartphone className="h-7 w-7" />
            </div>
            <h2 className="font-heading mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              View, create & manage products on the go
            </h2>
            <p className="mt-3 text-muted-foreground">
              Download the GemX mobile app to browse certified gemstones and jewellery, list your own pieces, and manage your listings from anywhere.
            </p>
            <ul className="mt-6 flex flex-wrap justify-center gap-6 lg:justify-start">
              <li className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Eye className="h-5 w-5 text-primary" />
                View listings
              </li>
              <li className="flex items-center gap-2 text-sm font-medium text-foreground">
                <PlusCircle className="h-5 w-5 text-primary" />
                Create products
              </li>
              <li className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Store className="h-5 w-5 text-primary" />
                Manage your store
              </li>
            </ul>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <Button size="lg" className="rounded-full px-8" asChild>
                <a href="#" aria-label="Download on the App Store">
                  App Store
                </a>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-8" asChild>
                <a href="#" aria-label="Get it on Google Play">
                  Google Play
                </a>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Links will be available when the app is published. Use the web admin to manage products in the meantime.
            </p>
          </div>
          <div className="flex h-64 w-64 shrink-0 items-center justify-center rounded-3xl border border-border bg-card shadow-lg">
            <Smartphone className="h-40 w-40 text-muted-foreground/50" />
          </div>
        </div>
      </div>
    </section>
  )
}
