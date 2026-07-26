// app/api/mobile/google-login/route.ts
import { auth } from "@/lib/auth";
import { creditDefaultRegistrationPointsToUser } from "@/features/points/db/points";
import { mobileDevicePayloadSchema } from "@/features/notifications/schemas/device";
import { handleAuthDeviceAndNotifications } from "@/features/notifications/services/register-device-on-auth";
import { db } from "@/drizzle/db";
import { user as userTable } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";

function decodeGoogleIdTokenEmail(idToken: string): string | null {
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const claims = JSON.parse(json) as { email?: unknown };
    return typeof claims.email === "string" ? claims.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const rl = rateLimit(`google-login:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return Response.json(
      { error: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  try {
    const body = await req.json();
    const idToken = typeof body?.idToken === "string" ? body.idToken : "";

    if (!idToken) {
      return Response.json({ error: "idToken is required" }, { status: 400 });
    }

    // Decoded (not verified) purely to detect new-vs-existing user before better-auth
    // creates the account. better-auth verifies the token's signature/audience itself.
    const email = decodeGoogleIdTokenEmail(idToken);
    let existedBefore = true;
    if (email) {
      const [row] = await db
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.email, email))
        .limit(1);
      existedBefore = Boolean(row);
    }

    const result = await auth.api.signInSocial({
      body: {
        provider: "google",
        idToken: { token: idToken },
      },
    });

    const userId =
      result && typeof result === "object" && "user" in result
        ? (result.user as { id?: string; name?: string | null })?.id
        : undefined;
    const userName =
      result && typeof result === "object" && "user" in result
        ? (result.user as { name?: string | null })?.name
        : undefined;

    if (userId) {
      const isNewUser = !existedBefore;
      if (isNewUser) {
        await creditDefaultRegistrationPointsToUser(userId);
      }

      const deviceParse = mobileDevicePayloadSchema.safeParse(body);
      const device = deviceParse.success ? deviceParse.data : undefined;
      void handleAuthDeviceAndNotifications({
        userId,
        userName,
        event: isNewUser ? "register" : "login",
        device,
      });
    }

    return Response.json(result, { status: existedBefore ? 200 : 201 });
  } catch {
    // Generic error to avoid leaking whether a token/provider issue caused the failure
    return Response.json({ error: "Google sign-in failed" }, { status: 401 });
  }
}
