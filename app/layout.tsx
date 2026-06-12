import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus_Jakarta_Sans, Geist_Mono, Cormorant_Garamond } from "next/font/google";
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
        className={`${plusJakartaSans.variable} ${geistMono.variable} ${cormorant.variable} font-sans antialiased`}
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
