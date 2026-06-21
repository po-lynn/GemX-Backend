import { getHomepageFeaturedProducts, getHomepageLabNames, getHomepageOwnProducts } from "@/features/products/db/products"
import { HomeNavbar } from "@/components/home/HomeNavbar"
import { HomeFooter } from "@/components/home/HomeFooter"
import { HeroSection } from "@/components/home/HeroSection"
import { LabLogosSection } from "@/components/home/LabLogosSection"
import { FeaturedSection } from "@/components/home/FeaturedSection"
import { TrustSection } from "@/components/home/TrustSection"
import { MobileAppSection } from "@/components/home/MobileAppSection"
import { CTASection } from "@/components/home/CTASection"
import { ContactSection } from "@/components/home/ContactSection"
import { OwnProductsSection } from "@/components/home/OwnProductsSection"

export default async function HomePage() {
  const [featured, labNames, ownProducts] = await Promise.all([
    getHomepageFeaturedProducts(4),
    getHomepageLabNames(),
    getHomepageOwnProducts(3),
  ])
  // first product goes in the hero badge, next 3 fill the featured cards
  const heroBadge = featured[0] ?? null
  const featuredCards = featured.length > 1 ? featured.slice(1, 4) : featured.slice(0, 3)

  return (
    <div style={{ width: "100%", overflowX: "hidden", background: "#ffffff", color: "#191525" }}>
      <HomeNavbar />
      <main>
        <HeroSection heroBadgeProduct={heroBadge} />
        <LabLogosSection labs={labNames} />
        <FeaturedSection products={featuredCards} />
        <OwnProductsSection products={ownProducts} />
        <TrustSection />
        <MobileAppSection />
        <CTASection />
        <ContactSection />
      </main>
      <HomeFooter />
    </div>
  )
}
