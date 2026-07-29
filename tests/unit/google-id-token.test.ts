import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const decodeProtectedHeaderMock = vi.fn();
const jwtVerifyMock = vi.fn();
vi.mock("jose", () => ({
  decodeProtectedHeader: decodeProtectedHeaderMock,
  jwtVerify: jwtVerifyMock,
}));

const getGooglePublicKeyMock = vi.fn().mockResolvedValue("fake-public-key");
vi.mock("better-auth/social-providers", () => ({
  getGooglePublicKey: getGooglePublicKeyMock,
}));

const { getTrustedGoogleAudiences, verifyGoogleIdToken } = await import("@/lib/google-id-token");

describe("getTrustedGoogleAudiences", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // The web OAuth client is always trusted, with no extra entries when unset.
  it("returns just GOOGLE_CLIENT_ID when GOOGLE_ADDITIONAL_CLIENT_IDS is unset", () => {
    process.env.GOOGLE_CLIENT_ID = "web-client-id";
    delete process.env.GOOGLE_ADDITIONAL_CLIENT_IDS;

    expect(getTrustedGoogleAudiences()).toEqual(["web-client-id"]);
  });

  // Mobile native sign-in (e.g. Android's auto-created companion web client) issues
  // idTokens audienced to a different client, so extra trusted client IDs must be included.
  it("parses comma-separated GOOGLE_ADDITIONAL_CLIENT_IDS and trims whitespace", () => {
    process.env.GOOGLE_CLIENT_ID = "web-client-id";
    process.env.GOOGLE_ADDITIONAL_CLIENT_IDS = " android-client-id , ios-client-id ,,";

    expect(getTrustedGoogleAudiences()).toEqual([
      "web-client-id",
      "android-client-id",
      "ios-client-id",
    ]);
  });
});

describe("verifyGoogleIdToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGooglePublicKeyMock.mockResolvedValue("fake-public-key");
    process.env.GOOGLE_CLIENT_ID = "web-client-id";
    process.env.GOOGLE_ADDITIONAL_CLIENT_IDS = "android-client-id";
  });

  // A token whose header is missing kid/alg can't be verified against Google's JWKS at all.
  it("returns false when the token header has no kid or alg", async () => {
    decodeProtectedHeaderMock.mockReturnValue({});

    const result = await verifyGoogleIdToken("fake-token");

    expect(result).toBe(false);
    expect(getGooglePublicKeyMock).not.toHaveBeenCalled();
  });

  // The whole point of this module: both the web and mobile (Android) client IDs must be
  // accepted as valid audiences, not just GOOGLE_CLIENT_ID.
  it("verifies the token against every trusted audience, including additional client IDs", async () => {
    decodeProtectedHeaderMock.mockReturnValue({ kid: "kid-1", alg: "RS256" });
    jwtVerifyMock.mockResolvedValue({ payload: {} });

    const result = await verifyGoogleIdToken("fake-token");

    expect(result).toBe(true);
    expect(getGooglePublicKeyMock).toHaveBeenCalledWith("kid-1");
    expect(jwtVerifyMock).toHaveBeenCalledWith(
      "fake-token",
      "fake-public-key",
      expect.objectContaining({
        audience: ["web-client-id", "android-client-id"],
        issuer: ["https://accounts.google.com", "accounts.google.com"],
      })
    );
  });

  // Nonce mismatch must still fail even though the signature/audience checked out.
  it("returns false when the nonce does not match the token's nonce claim", async () => {
    decodeProtectedHeaderMock.mockReturnValue({ kid: "kid-1", alg: "RS256" });
    jwtVerifyMock.mockResolvedValue({ payload: { nonce: "expected-nonce" } });

    const result = await verifyGoogleIdToken("fake-token", "different-nonce");

    expect(result).toBe(false);
  });

  // Matching nonce alongside a valid signature/audience should verify successfully.
  it("returns true when the nonce matches", async () => {
    decodeProtectedHeaderMock.mockReturnValue({ kid: "kid-1", alg: "RS256" });
    jwtVerifyMock.mockResolvedValue({ payload: { nonce: "expected-nonce" } });

    const result = await verifyGoogleIdToken("fake-token", "expected-nonce");

    expect(result).toBe(true);
  });

  // An invalid signature or audience mismatch causes jose to throw; that must propagate so
  // the caller (better-auth / the social-login route) treats it as a failed verification.
  it("propagates the error when jwtVerify rejects (e.g. bad signature or audience mismatch)", async () => {
    decodeProtectedHeaderMock.mockReturnValue({ kid: "kid-1", alg: "RS256" });
    jwtVerifyMock.mockRejectedValue(new Error("signature verification failed"));

    await expect(verifyGoogleIdToken("fake-token")).rejects.toThrow(
      "signature verification failed"
    );
  });
});
