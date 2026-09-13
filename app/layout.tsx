import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus_Jakarta_Sans, Geist_Mono, Cormorant_Garamond, Bricolage_Grotesque, Manrope, Noto_Sans_Myanmar } from "next/font/google";
import { AppSpeedInsights } from "@/components/app-speed-insights";
import { GlobalPushProvider } from "@/components/notifications/GlobalPushProvider";
import { Analytics } from '@vercel/analytics/next';
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Plus Jakarta Sans has no Myanmar glyphs; without this the browser falls back to whatever
// (possibly missing) Myanmar font the OS provides, rendering NRC township/type text as tofu —
// see docs/technical/admin-nrc-form-fix.md. Declared as a --font-sans fallback in globals.css.
const notoSansMyanmar = Noto_Sans_Myanmar({
  variable: "--font-noto-myanmar",
  subsets: ["myanmar"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "GemX | Premium Gemstone & Jewellery Marketplace",
  description:
    "Discover certified loose gemstones and fine jewellery. Lab reports, transparent sellers, and a trusted marketplace for collectors.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${plusJakartaSans.variable} ${geistMono.variable} ${cormorant.variable} ${bricolageGrotesque.variable} ${manrope.variable} ${notoSansMyanmar.variable} font-sans antialiased`}
      >
        <GlobalPushProvider>
          <Suspense fallback={null}>{children}</Suspense>
        </GlobalPushProvider>
        {/* usePathname() is dynamic; must be inside Suspense for Cache Components / prerender */}
        <Suspense fallback={null}>
          <AppSpeedInsights />
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
