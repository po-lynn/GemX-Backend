"use client"

import { useEffect } from "react"
import { productDeepLinkUrl } from "@/lib/deep-link"

/**
 * This page only renders when Universal/App Link verification didn't route the
 * tap straight into the app (app not installed, or verification hasn't
 * propagated yet). Attempting the custom scheme here is a same-page redirect,
 * not a shared link, so it doesn't hit the "chat apps don't linkify gemx://"
 * problem the mobile side avoided by dropping the scheme from share URLs.
 */
export function OpenInAppRedirect({ productId }: { productId: string }) {
  useEffect(() => {
    window.location.href = productDeepLinkUrl(productId)
  }, [productId])

  return null
}
