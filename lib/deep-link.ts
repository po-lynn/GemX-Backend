/** Mirrors the mobile app's bundle/package IDs (app.json in the Expo repo). Not secret. */
export const IOS_BUNDLE_ID = "com.kyawminkhant.GemX"
export const ANDROID_PACKAGE_NAME = "com.kyawminkhant.GemX"

/** Apple Developer Team ID — Apple Developer > Membership, or `eas credentials -p ios`. */
export const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID ?? ""

export const APPLE_APP_ID = `${APPLE_TEAM_ID}.${IOS_BUNDLE_ID}`

/**
 * Production Android signing cert fingerprint(s), comma-separated.
 * `eas credentials -p android` > production build credentials. The repo's
 * android/app/debug.keystore is debug-only and will not match production installs.
 */
export const ANDROID_SHA256_CERT_FINGERPRINTS = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS ?? "")
  .split(",")
  .map((fingerprint) => fingerprint.trim())
  .filter(Boolean)

export const IOS_APP_STORE_URL =
  process.env.IOS_APP_STORE_URL ?? "https://apps.apple.com/app/idXXXXXXXXX"

export const ANDROID_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`

export function productDeepLinkUrl(productId: string): string {
  return `gemx://products/${productId}`
}
