import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as loginPost } from "@/app/api/mobile/login/route";
import { POST as registerPost } from "@/app/api/mobile/register/route";
import { auth } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      signInEmail: vi.fn(),
      signUpEmail: vi.fn(),
    },
  },
}));

vi.mock("@/features/points/db/points", () => ({
  creditDefaultRegistrationPointsToUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/drizzle/db", () => ({
  db: { update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })) },
}));

vi.mock("@/features/notifications/services/register-device-on-auth", () => ({
  handleAuthDeviceAndNotifications: vi.fn().mockResolvedValue(undefined),
}));

const { handleAuthDeviceAndNotifications } = await import(
  "@/features/notifications/services/register-device-on-auth"
);

describe("mobile auth notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Login route should trigger device save + login push after successful sign-in.
  it("calls handleAuthDeviceAndNotifications on successful login", async () => {
    vi.mocked(auth.api.signInEmail).mockResolvedValue({
      user: { id: "user-1" },
      token: "session-token",
    } as never);

    const req = new Request("http://localhost/api/mobile/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "09123456789",
        password: "secret123",
        fcmToken: "fcm-abc",
        platform: "android",
        deviceName: "Test Phone",
      }),
    });

    const res = await loginPost(req);
    expect(res.status).toBe(200);
    expect(handleAuthDeviceAndNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        event: "login",
        device: expect.objectContaining({ fcmToken: "fcm-abc", platform: "android" }),
      })
    );
  });

  // Register route should trigger welcome push after successful sign-up.
  it("calls handleAuthDeviceAndNotifications on successful register", async () => {
    vi.mocked(auth.api.signUpEmail).mockResolvedValue({
      user: { id: "user-2", role: "user" },
      token: "session-token",
    } as never);

    const req = new Request("http://localhost/api/mobile/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "09987654321",
        password: "secret123",
        name: "Aung",
        fcmToken: "fcm-xyz",
        platform: "ios",
      }),
    });

    const res = await registerPost(req);
    expect(res.status).toBe(201);
    expect(handleAuthDeviceAndNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-2",
        event: "register",
        userName: "Aung",
        device: expect.objectContaining({ fcmToken: "fcm-xyz" }),
      })
    );
  });
});
