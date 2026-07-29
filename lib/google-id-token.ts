import { decodeProtectedHeader, jwtVerify } from "jose";
import { getGooglePublicKey } from "better-auth/social-providers";

// better-auth's built-in Google verifyIdToken only accepts a single audience
// (GOOGLE_CLIENT_ID). Native mobile Google Sign-In (e.g. Android) can issue idTokens
// audienced to a different client — such as the "Web client (auto created by Google
// Service)" paired with an Android OAuth client — so this list holds every audience we trust.
export function getTrustedGoogleAudiences(): string[] {
  return [
    process.env.GOOGLE_CLIENT_ID as string,
    ...(process.env.GOOGLE_ADDITIONAL_CLIENT_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  ];
}

export async function verifyGoogleIdToken(token: string, nonce?: string): Promise<boolean> {
  const { kid, alg } = decodeProtectedHeader(token);
  if (!kid || !alg) return false;

  const publicKey = await getGooglePublicKey(kid);
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: [alg],
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: getTrustedGoogleAudiences(),
    maxTokenAge: "1h",
  });

  if (nonce && payload.nonce !== nonce) return false;
  return true;
}
