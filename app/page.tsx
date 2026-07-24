import { getHomepageLabNames, getHomepageOwnProducts } from "@/features/products/db/products"
import { HomeNavbar } from "@/components/home/HomeNavbar"
import { HomeFooter } from "@/components/home/HomeFooter"
import { HeroSection } from "@/components/home/HeroSection"
import { LabLogosSection } from "@/components/home/LabLogosSection"
import { TrustSection } from "@/components/home/TrustSection"
import { MobileAppSection } from "@/components/home/MobileAppSection"
import { ContactSection } from "@/components/home/ContactSection"
import { OwnProductsSection } from "@/components/home/OwnProductsSection"

export default async function HomePage() {
  const [labNames, ownProducts] = await Promise.all([
    getHomepageLabNames(),
    getHomepageOwnProducts(8),
  ])

  return (
    <div
      style={{
        width: "100%",
        overflowX: "hidden",
        background: "#E9E6F2",
        backgroundImage:
          "radial-gradient(circle at 15% 8%, #efe6ff 0, transparent 40%), radial-gradient(circle at 85% 30%, #e4f6ef 0, transparent 40%)",
        color: "#171326",
        fontFamily: "var(--font-manrope)",
      }}
    >
      <div style={{
        background: "linear-gradient(90deg,#5B3DF5,#7C3AED)", color: "#fff",
        textAlign: "center", fontSize: 12.5, fontWeight: 600, letterSpacing: "0.04em",
        padding: "9px 16px",
      }}>
        Certified gemstones &amp; fine jewellery · shipped worldwide
      </div>
      <HomeNavbar />
      <main>
        <HeroSection />
        <LabLogosSection labs={labNames} />
        <OwnProductsSection products={ownProducts} />
        <TrustSection />
        <MobileAppSection />
        <ContactSection />
      </main>
      <HomeFooter />
    </div>
  )
}
