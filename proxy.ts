// proxy.ts (at project root, next to app/)
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Block web signup; mobile uses /api/mobile/register (server-side auth.api.signUpEmail)
  if (pathname === "/api/auth/sign-up/email" && request.method === "POST") {
    return NextResponse.json(
      { error: "Sign up is not allowed on the website" },
      { status: 403 }
    )
  }

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next()
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (session.user.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/api/auth/sign-up/email"],
}