// app/api/mobile/login/route.ts
import { auth } from "@/lib/auth";
import { mobileDevicePayloadSchema } from "@/features/notifications/schemas/device";
import { handleAuthDeviceAndNotifications } from "@/features/notifications/services/register-device-on-auth";
import { normalizeMyanmarPhone, internalEmailFromPhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const rl = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
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

    const rawPhone = body?.phone;
    const password = String(body?.password || "");

    const phone = normalizeMyanmarPhone(rawPhone);

    if (!phone || !password) {
      return Response.json(
        { error: "Phone must start with 09 and password is required" },
        { status: 400 },
      );
    }

    const email = internalEmailFromPhone(phone);

    const result = await auth.api.signInEmail({
      body: { email, password },
    });

    const userId =
      result && typeof result === "object" && "user" in result
        ? (result.user as { id?: string })?.id
        : undefined;

    if (userId) {
      const deviceParse = mobileDevicePayloadSchema.safeParse(body);
      const device = deviceParse.success ? deviceParse.data : undefined;
      void handleAuthDeviceAndNotifications({
        userId,
        event: "login",
        device,
      });
    }

    return Response.json(result, { status: 200 });
  } catch {
    // Generic error to avoid user enumeration
    return Response.json(
      { error: "Invalid phone number or password" },
      { status: 401 },
    );
  }
}
