"use client";

import { SpeedInsights } from "@vercel/speed-insights/react";
import { usePathname } from "next/navigation";

/**
 * Uses the React entry instead of `@vercel/speed-insights/next` so bundlers
 * don't need to resolve that package's `next/navigation.js` re-export chain.
 * Pass the current pathname so routes are tracked like the Next integration.
 */
export function AppSpeedInsights() {
  const pathname = usePathname();
  return <SpeedInsights framework="next" route={pathname ?? undefined} />;
}
