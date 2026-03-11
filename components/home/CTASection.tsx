import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Smartphone } from "lucide-react"

export function CTASection() {
  return (
    <section className="border-t border-border py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 text-primary-foreground sm:px-12 sm:py-20">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              background:
                "radial-gradient(circle at 20% 50%, white 0%, transparent 50%), radial-gradient(circle at 80% 80%, white 0%, transparent 40%)",
            }}
          />
          <div className="relative z-10 mx-auto max-w-2xl text-center">
            <Smartphone className="mx-auto h-12 w-12 opacity-90" />
            <h2 className="font-heading mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Get the app to view & sell
            </h2>
            <p className="mt-4 text-lg opacity-90">
              Browse products, create listings, and manage your store from your phone. Download the GemX app for iOS or Android.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button
                size="lg"
                variant="secondary"
                className="gap-2 rounded-full bg-white text-primary hover:bg-white/90"
                asChild
              >
                <Link href="/#app">Download mobile app</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
