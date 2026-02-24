// app/api/mobile/register/route.ts
import { auth } from "@/lib/auth";
import { applyDefaultPointsToNewUser } from "@/features/points/db/points";

function normalizeMyanmarPhone(input: string) {
  let p = String(input || "").trim();

  // remove spaces and dashes
  p = p.replace(/[\s-]/g, "");

  // must start with 09
  if (!p.startsWith("09")) return null;

  // must be digits only after 09
  if (!/^09\d{7,15}$/.test(p)) return null;

  // convert 09xxxxxxxx -> +959xxxxxxxx
  return "+95" + p.slice(1);
}

function internalEmailFromPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `user_${digits}@phone.local`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const rawPhone = body?.phone;
    const password = String(body?.password || "");
    const name = String(body?.name || "Mobile User");
    const nrc = body?.nrc != null ? String(body.nrc).trim() || null : null;
    const address = body?.address != null ? String(body.address).trim() || null : null;
    const city = body?.city != null ? String(body.city).trim() || null : null;
    const state = body?.state != null ? String(body.state).trim() || null : null;
    const country = body?.country != null ? String(body.country).trim() || null : null;
    const gender = body?.gender != null ? String(body.gender).trim() || null : null;
    const dateOfBirth = body?.dateOfBirth != null ? String(body.dateOfBirth).trim() || null : null;

    const phone = normalizeMyanmarPhone(rawPhone);

    if (!phone || !password) {
      return Response.json(
        { error: "Phone must start with 09 and password is required" },
        { status: 400 },
      );
    }

    const email = internalEmailFromPhone(phone);
    // better-auth username plugin rejects "+" and other non-alphanumeric; use digits only
    const usernameForAuth = phone.replace(/\D/g, "");
    const signUpBody = {
      email,
      password,
      name,
      username: usernameForAuth,
      displayUsername: name,
      phone,
      role: "mobile",
      nrc,
      address,
      city,
      state,
      country,
      gender,
      dateOfBirth,
    };

    const result = await auth.api.signUpEmail({
      body: signUpBody,
    });

    if (result && "error" in result) {
      const msg = typeof result.error === "string" ? result.error : String((result as { error?: unknown }).error ?? "Registration failed");
      const status = msg.toLowerCase().includes("already") || msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique") ? 409 : 400;
      return Response.json({ error: msg }, { status });
    }

    if (result) {
      await applyDefaultPointsToNewUser(email);
    }
    return Response.json(result, { status: 201 });
  } catch (err: unknown) {
    const e = err as { message?: string; cause?: { message?: string }; name?: string; stack?: string };
    const msg = String(e?.message ?? (e?.cause && typeof e.cause === "object" && "message" in e.cause ? (e.cause as { message?: string }).message : "") ?? "");

    if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) {
      return Response.json(
        { error: "This phone number is already registered" },
        { status: 409 },
      );
    }

    const errorMessage = msg.trim() || "Registration failed";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
