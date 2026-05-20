import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetFirebaseAdminForTests } from "@/features/notifications/firebase/admin";

vi.mock("@/features/notifications/firebase/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/notifications/firebase/admin")>();
  return {
    ...actual,
    getFirebaseAdmin: vi.fn(),
  };
});

vi.mock("@/features/notifications/db/user-devices", () => ({
  removeUserDevicesByFcmTokens: vi.fn().mockResolvedValue(0),
}));

const { getFirebaseAdmin } = await import("@/features/notifications/firebase/admin");
const { sendPushNotification } = await import(
  "@/features/notifications/services/send-push-notification"
);

describe("sendPushNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseAdminForTests();
  });

  // No tokens should short-circuit without calling Firebase.
  it("returns zero counts when no tokens provided", async () => {
    const result = await sendPushNotification([], { title: "Hi" });
    expect(result).toEqual({ sent: 0, failed: 0, invalidTokensRemoved: 0 });
    expect(getFirebaseAdmin).not.toHaveBeenCalled();
  });

  // When Firebase env is missing, sender should not throw.
  it("skips send when Firebase is not configured", async () => {
    vi.mocked(getFirebaseAdmin).mockResolvedValue(null);
    const result = await sendPushNotification(["token-a"], { title: "Hi", body: "Test" });
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
  });

  // Happy path uses multicast API.
  it("sends multicast when Firebase is configured", async () => {
    const sendEachForMulticast = vi.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    });
    vi.mocked(getFirebaseAdmin).mockResolvedValue({
      messaging: () => ({ sendEachForMulticast }),
    } as never);

    const result = await sendPushNotification(["token-a"], {
      title: "Hello",
      body: "World",
      data: { type: "welcome" },
    });

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(sendEachForMulticast).toHaveBeenCalledOnce();
  });
});
