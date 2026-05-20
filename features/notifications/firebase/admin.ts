import { env } from "@/data/env/server";

let firebaseAdmin: typeof import("firebase-admin") | null = null;
let firebaseAdminInitSkipped = false;

/**
 * Service account `private_key` from JSON is often pasted into `.env` with:
 * outer quotes, JSON-escaped newlines, BOM, or doubled quoting from copy/paste.
 */
export function normalizeFirebasePrivateKey(raw: string): string {
  let k = raw.trim().replace(/^\uFEFF/, "");
  for (let i = 0; i < 3; i++) {
    if (
      (k.startsWith('"') && k.endsWith('"')) ||
      (k.startsWith("'") && k.endsWith("'"))
    ) {
      k = k.slice(1, -1).trim();
    } else {
      break;
    }
  }
  if (k.startsWith('"') && k.endsWith('"')) {
    try {
      k = JSON.parse(k) as string;
    } catch {
      /* keep k */
    }
  }
  k = k.trim().replace(/^\uFEFF/, "");
  k = k.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\n");
  k = k.replace(/\\"/g, '"');
  return k;
}

/** Lazy-init Firebase Admin SDK. Returns null when env is missing or init fails. */
export async function getFirebaseAdmin(): Promise<typeof import("firebase-admin") | null> {
  if (firebaseAdminInitSkipped) return null;
  if (firebaseAdmin) return firebaseAdmin;

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    return null;
  }

  try {
    const admin = (await import("firebase-admin")).default;
    if (admin.apps.length > 0) {
      firebaseAdmin = admin;
      return admin;
    }
    const privateKey = normalizeFirebasePrivateKey(FIREBASE_PRIVATE_KEY);
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
    firebaseAdmin = admin;
    return admin;
  } catch (e) {
    firebaseAdminInitSkipped = true;
    console.error(
      "Firebase Admin init failed (push disabled until restart). Fix FIREBASE_PRIVATE_KEY PEM / newlines.",
      e
    );
    return null;
  }
}

/** Reset cached admin instance (for tests). */
export function resetFirebaseAdminForTests(): void {
  firebaseAdmin = null;
  firebaseAdminInitSkipped = false;
}
