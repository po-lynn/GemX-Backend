import { HomeNavbar } from "@/components/home/HomeNavbar"
import { HomeFooter } from "@/components/home/HomeFooter"
import { HeroSection } from "@/components/home/HeroSection"
import { MobileAppSection } from "@/components/home/MobileAppSection"
import { CategoryShowcase } from "@/components/home/CategoryShowcase"
import { TrustSection } from "@/components/home/TrustSection"
import { CTASection } from "@/components/home/CTASection"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <HomeNavbar />
      <main>
        <HeroSection />
        <MobileAppSection />
        <CategoryShowcase />
        <TrustSection />
        <CTASection />
      </main>
      <HomeFooter />
    </div>
  )
}
