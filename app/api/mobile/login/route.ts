// app/api/mobile/login/route.ts
import { auth } from "@/lib/auth";

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

    const phone = normalizeMyanmarPhone(rawPhone);

    if (!phone || !password) {
      return Response.json(
        { error: "Phone must start with 09 and password is required" },
        { status: 400 },
      );
    }

    const email = internalEmailFromPhone(phone);

    const result = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
    });

    return Response.json(result, { status: 200 });
  } catch {
    // Generic error to avoid user enumeration
    return Response.json(
      { error: "Invalid phone number or password" },
      { status: 401 },
    );
  }
}
