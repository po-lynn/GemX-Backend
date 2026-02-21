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
    };

    const result = await auth.api.signUpEmail({
      body: signUpBody,
    });

    if (result && !("error" in result)) {
      await applyDefaultPointsToNewUser(email);
    }
    return Response.json(result, { status: 201 });
  } catch (err: unknown) {
    const e = err as { message?: string; name?: string; cause?: unknown; stack?: string };
    const msg = String(e?.message ?? "");

    if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) {
      return Response.json(
        { error: "This phone number is already registered" },
        { status: 409 },
      );
    }

    return Response.json({ error: "Registration failed" }, { status: 500 });
  }
}
