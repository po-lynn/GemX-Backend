import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as socialLoginPost } from "@/app/api/mobile/social-login/route";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      signInSocial: vi.fn(),
    },
  },
}));

vi.mock("@/features/points/db/points", () => ({
  creditDefaultRegistrationPointsToUser: vi.fn().mockResolvedValue({ pointsAdded: 50 }),
}));

const limitMock = vi.fn();
const updateWhereMock = vi.fn().mockResolvedValue(undefined);
const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: limitMock,
        })),
      })),
    })),
    update: vi.fn(() => ({ set: updateSetMock })),
  },
}));

vi.mock("@/drizzle/schema", () => ({
  user: { id: "id", email: "email" },
}));

vi.mock("@/features/notifications/services/register-device-on-auth", () => ({
  handleAuthDeviceAndNotifications: vi.fn().mockResolvedValue(undefined),
}));

const { creditDefaultRegistrationPointsToUser } = await import("@/features/points/db/points");
const { handleAuthDeviceAndNotifications } = await import(
  "@/features/notifications/services/register-device-on-auth"
);

function makeIdToken(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.fake-signature`;
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/mobile/social-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mobile/social-login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitMock.mockResolvedValue([]);
    updateWhereMock.mockResolvedValue(undefined);
  });

  // Brand-new Google sign-in: no existing user row for the token's email, so this is a
  // registration — should credit the welcome bonus and send the welcome push, not login.
  it("treats a first-time Google sign-in as registration: credits points, sends welcome push, returns 201", async () => {
    limitMock.mockResolvedValue([]);
    vi.mocked(auth.api.signInSocial).mockResolvedValue({
      redirect: false,
      token: "session-token",
      user: { id: "user-1", name: "Aung", email: "aung@gmail.com" },
    } as never);

    const idToken = makeIdToken({ email: "aung@gmail.com" });
    const res = await socialLoginPost(
      makeRequest({ provider: "google", idToken, fcmToken: "fcm-1", platform: "android" })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.token).toBe("session-token");
    expect(creditDefaultRegistrationPointsToUser).toHaveBeenCalledWith("user-1");
    expect(handleAuthDeviceAndNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        event: "register",
        userName: "Aung",
        device: expect.objectContaining({ fcmToken: "fcm-1" }),
      })
    );
  });

  // Returning Google user: email already has a user row, so this is a login — no bonus
  // points, login push instead of welcome push.
  it("treats a Google sign-in with an existing user row as login: no points, login push, returns 200", async () => {
    limitMock.mockResolvedValue([{ id: "user-1" }]);
    vi.mocked(auth.api.signInSocial).mockResolvedValue({
      redirect: false,
      token: "session-token",
      user: { id: "user-1", name: "Aung", email: "aung@gmail.com" },
    } as never);

    const idToken = makeIdToken({ email: "aung@gmail.com" });
    const res = await socialLoginPost(makeRequest({ provider: "google", idToken }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.token).toBe("session-token");
    expect(creditDefaultRegistrationPointsToUser).not.toHaveBeenCalled();
    expect(handleAuthDeviceAndNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", event: "login" })
    );
  });

  // Missing idToken must be rejected before ever calling better-auth.
  it("returns 400 when idToken is missing", async () => {
    const res = await socialLoginPost(makeRequest({ provider: "google" }));
    expect(res.status).toBe(400);
    expect(auth.api.signInSocial).not.toHaveBeenCalled();
  });

  // Unsupported provider (e.g. Facebook isn't wired yet) must be rejected before ever
  // calling better-auth, with a clear list of what is supported.
  it("returns 400 for an unsupported provider", async () => {
    const idToken = makeIdToken({ email: "aung@gmail.com" });
    const res = await socialLoginPost(makeRequest({ provider: "facebook", idToken }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Unsupported provider/);
    expect(auth.api.signInSocial).not.toHaveBeenCalled();
  });

  // Invalid/expired token: better-auth throws (invalid signature, audience mismatch, etc).
  // Response must stay generic — no detail on why verification failed.
  it("returns 401 with a generic error when better-auth rejects the token", async () => {
    vi.mocked(auth.api.signInSocial).mockRejectedValue(new Error("INVALID_TOKEN"));

    const idToken = makeIdToken({ email: "aung@gmail.com" });
    const res = await socialLoginPost(makeRequest({ provider: "google", idToken }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Social sign-in failed");
    expect(creditDefaultRegistrationPointsToUser).not.toHaveBeenCalled();
  });

  // A malformed idToken (can't be decoded) should still be forwarded to better-auth for
  // verification (which will reject it) rather than crashing the route on decode.
  it("falls back to treating the user as existing (no bonus credit) when the token can't be decoded", async () => {
    vi.mocked(auth.api.signInSocial).mockResolvedValue({
      redirect: false,
      token: "session-token",
      user: { id: "user-1", name: "Aung" },
    } as never);

    const res = await socialLoginPost(makeRequest({ provider: "google", idToken: "not-a-real-jwt" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.token).toBe("session-token");
    expect(creditDefaultRegistrationPointsToUser).not.toHaveBeenCalled();
  });

  // New signup with the Screen-1 profile fields attached: they should be written in one
  // combined call, no separate PATCH /api/mobile/profile round trip required.
  it("writes provided profile fields to the user row for a new signup", async () => {
    limitMock.mockResolvedValue([]);
    vi.mocked(auth.api.signInSocial).mockResolvedValue({
      redirect: false,
      token: "session-token",
      user: { id: "user-1", name: "Aung", email: "aung@gmail.com" },
    } as never);

    const idToken = makeIdToken({ email: "aung@gmail.com" });
    const res = await socialLoginPost(
      makeRequest({
        provider: "google",
        idToken,
        country: "Others",
        state: "Bangkok",
        city: "Bangkok",
        address: "123 Main St",
        gender: "male",
        dateOfBirth: "1990-01-15",
        nrc: "PASSPORT123",
      })
    );

    expect(res.status).toBe(201);
    expect(db.update).toHaveBeenCalled();
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        country: "Others",
        state: "Bangkok",
        city: "Bangkok",
        address: "123 Main St",
        gender: "male",
        dateOfBirth: "1990-01-15",
        nrc: "PASSPORT123",
      })
    );
  });

  // Returning user must never have profile fields overwritten by a login call — those
  // updates only happen through PATCH /api/mobile/profile once signed in.
  it("ignores profile fields for an existing (returning) user", async () => {
    limitMock.mockResolvedValue([{ id: "user-1" }]);
    vi.mocked(auth.api.signInSocial).mockResolvedValue({
      redirect: false,
      token: "session-token",
      user: { id: "user-1", name: "Aung", email: "aung@gmail.com" },
    } as never);

    const idToken = makeIdToken({ email: "aung@gmail.com" });
    const res = await socialLoginPost(
      makeRequest({ provider: "google", idToken, country: "Others", address: "123 Main St" })
    );

    expect(res.status).toBe(200);
    expect(db.update).not.toHaveBeenCalled();
  });

  // A malformed Myanmar NRC is rejected before ever calling better-auth, same as register.
  it("returns 400 for an invalid NRC format when country is Myanmar (or unset)", async () => {
    const idToken = makeIdToken({ email: "aung@gmail.com" });
    const res = await socialLoginPost(makeRequest({ provider: "google", idToken, nrc: "not-an-nrc" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid NRC format/);
    expect(auth.api.signInSocial).not.toHaveBeenCalled();
  });

  // Non-Myanmar country: nrc is treated as a free-text passport/national ID, no format check.
  it("accepts a plain passport/national ID in nrc when country is not Myanmar", async () => {
    limitMock.mockResolvedValue([]);
    vi.mocked(auth.api.signInSocial).mockResolvedValue({
      redirect: false,
      token: "session-token",
      user: { id: "user-1", name: "Aung", email: "aung@gmail.com" },
    } as never);

    const idToken = makeIdToken({ email: "aung@gmail.com" });
    const res = await socialLoginPost(
      makeRequest({ provider: "google", idToken, country: "Others", nrc: "PASSPORT123" })
    );

    expect(res.status).toBe(201);
  });
});
