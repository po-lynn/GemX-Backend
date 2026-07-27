// app/api/mobile/social-login/route.ts
import { auth } from "@/lib/auth";
import { creditDefaultRegistrationPointsToUser } from "@/features/points/db/points";
import { mobileDevicePayloadSchema } from "@/features/notifications/schemas/device";
import { handleAuthDeviceAndNotifications } from "@/features/notifications/services/register-device-on-auth";
import { db } from "@/drizzle/db";
import { user as userTable } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { validateNrc } from "@/lib/nrc";

// Only Google's native idToken flow is verified against better-auth today. Facebook's
// native SDK returns an accessToken (not an idToken/JWT), so it needs a different request
// shape and a verified `signInSocial` call before it can be added here — see docs/guides/social-login.md.
const SUPPORTED_PROVIDERS = ["google"] as const;
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

function isSupportedProvider(value: unknown): value is SupportedProvider {
  return typeof value === "string" && (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

function readOptionalString(value: unknown): string | null {
  return value != null ? String(value).trim() || null : null;
}

function decodeIdTokenEmail(idToken: string): string | null {
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
  const rl = rateLimit(`social-login:${ip}`, 10, 15 * 60 * 1000);
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
    const provider = body?.provider;
    const idToken = typeof body?.idToken === "string" ? body.idToken : "";

    if (!isSupportedProvider(provider)) {
      return Response.json(
        { error: `Unsupported provider. Supported: ${SUPPORTED_PROVIDERS.join(", ")}` },
        { status: 400 },
      );
    }
    if (!idToken) {
      return Response.json({ error: "idToken is required" }, { status: 400 });
    }

    // Optional profile fields, collected on the same signup screen as Myanmar phone
    // registration and submitted alongside the idToken so non-Myanmar signups complete in one call.
    const name = readOptionalString(body?.name);
    const country = readOptionalString(body?.country);
    const state = readOptionalString(body?.state);
    const city = readOptionalString(body?.city);
    const address = readOptionalString(body?.address);
    const gender = readOptionalString(body?.gender);
    const dateOfBirth = readOptionalString(body?.dateOfBirth);
    const nrc = readOptionalString(body?.nrc);
    const nrcFrontUrl = readOptionalString(body?.nrcFrontUrl);
    const nrcBackUrl = readOptionalString(body?.nrcBackUrl);
    const selfieUrl = readOptionalString(body?.selfieUrl);
    const businessLicenseUrl = readOptionalString(body?.businessLicenseUrl);

    // nrc doubles as a passport/national ID for non-Myanmar signups, so only enforce the
    // Myanmar NRC format when country is Myanmar (or unset).
    const isMyanmar = !country || country.toLowerCase() === "myanmar";
    if (nrc && isMyanmar && !validateNrc(nrc)) {
      return Response.json(
        { error: "Invalid NRC format. Expected format: 12/ABC(N)123456 or the Myanmar script equivalent" },
        { status: 400 },
      );
    }

    // Decoded (not verified) purely to detect new-vs-existing user before better-auth
    // creates the account. better-auth verifies the token's signature/audience itself.
    const email = decodeIdTokenEmail(idToken);
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
        provider,
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

        // Only a fresh signup gets these fields written — a returning login must never
        // have its existing profile silently overwritten by stale client-side form data.
        const profileUpdates: Record<string, unknown> = {};
        if (name) profileUpdates.name = name;
        if (country) profileUpdates.country = country;
        if (state) profileUpdates.state = state;
        if (city) profileUpdates.city = city;
        if (address) profileUpdates.address = address;
        if (gender) profileUpdates.gender = gender;
        if (dateOfBirth) profileUpdates.dateOfBirth = dateOfBirth;
        if (nrc) profileUpdates.nrc = nrc;
        if (nrcFrontUrl) profileUpdates.nrcFrontUrl = nrcFrontUrl;
        if (nrcBackUrl) profileUpdates.nrcBackUrl = nrcBackUrl;
        if (selfieUrl) profileUpdates.selfieUrl = selfieUrl;
        if (businessLicenseUrl) profileUpdates.businessLicenseUrl = businessLicenseUrl;

        if (Object.keys(profileUpdates).length > 0) {
          try {
            await db
              .update(userTable)
              .set({ ...profileUpdates, updatedAt: new Date() })
              .where(eq(userTable.id, userId));
          } catch (err: unknown) {
            const msg = String((err as { message?: string })?.message ?? "");
            if (msg.includes("user_nrc_unique") || (msg.includes("unique") && msg.includes("nrc"))) {
              return Response.json(
                { error: "This NRC number is already registered to another account." },
                { status: 409 },
              );
            }
            return Response.json(
              { error: "Account created, but saving profile details failed." },
              { status: 500 },
            );
          }
        }
      }

      const deviceParse = mobileDevicePayloadSchema.safeParse(body);
      const device = deviceParse.success ? deviceParse.data : undefined;
      void handleAuthDeviceAndNotifications({
        userId,
        userName: name ?? userName,
        event: isNewUser ? "register" : "login",
        device,
      });
    }

    return Response.json(result, { status: existedBefore ? 200 : 201 });
  } catch {
    // Generic error to avoid leaking whether a token/provider issue caused the failure
    return Response.json({ error: "Social sign-in failed" }, { status: 401 });
  }
}
