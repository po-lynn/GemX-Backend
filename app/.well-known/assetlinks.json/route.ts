import { NextResponse } from "next/server"
import { ANDROID_PACKAGE_NAME, ANDROID_SHA256_CERT_FINGERPRINTS } from "@/lib/deep-link"

export function GET() {
  return NextResponse.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE_NAME,
        sha256_cert_fingerprints: ANDROID_SHA256_CERT_FINGERPRINTS,
      },
    },
  ])
}
