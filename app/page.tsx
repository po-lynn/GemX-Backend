import { getHomepageLabNames, getHomepageOwnProducts } from "@/features/products/db/products"
import { HomeNavbar } from "@/components/home/HomeNavbar"
import { HomeFooter } from "@/components/home/HomeFooter"
import { HeroSection } from "@/components/home/HeroSection"
import { LabLogosSection } from "@/components/home/LabLogosSection"
import { TrustSection } from "@/components/home/TrustSection"
import { MobileAppSection } from "@/components/home/MobileAppSection"
import { CTASection } from "@/components/home/CTASection"
import { ContactSection } from "@/components/home/ContactSection"
import { OwnProductsSection } from "@/components/home/OwnProductsSection"

export default async function HomePage() {
  const [labNames, ownProducts] = await Promise.all([
    getHomepageLabNames(),
    getHomepageOwnProducts(3),
  ])

  return (
    <div style={{ width: "100%", overflowX: "hidden", background: "#ffffff", color: "#191525" }}>
      <HomeNavbar />
      <main>
        <HeroSection />
        <LabLogosSection labs={labNames} />
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
