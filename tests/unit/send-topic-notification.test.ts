import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/notifications/firebase/admin", () => ({
  getFirebaseAdmin: vi.fn(),
}));

const { getFirebaseAdmin } = await import("@/features/notifications/firebase/admin");
const { sendPushToTopic } = await import(
  "@/features/notifications/services/send-topic-notification"
);

describe("sendPushToTopic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects empty topic without calling Firebase", async () => {
    const result = await sendPushToTopic("", { title: "Hi" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("INVALID_PAYLOAD");
    expect(getFirebaseAdmin).not.toHaveBeenCalled();
  });

  it("returns FCM_NOT_CONFIGURED when Firebase is unavailable", async () => {
    vi.mocked(getFirebaseAdmin).mockResolvedValue(null);
    const result = await sendPushToTopic("global", { title: "Hello" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("FCM_NOT_CONFIGURED");
  });

  it("sends to topic and returns messageId on success", async () => {
    const send = vi.fn().mockResolvedValue("projects/x/messages/123");
    vi.mocked(getFirebaseAdmin).mockResolvedValue({
      messaging: () => ({ send }),
    } as never);

    const result = await sendPushToTopic("global", {
      title: "Broadcast",
      body: "Everyone",
      data: { screen: "home", type: "home" },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.messageId).toBe("projects/x/messages/123");
      expect(result.topic).toBe("global");
    }
    expect(send).toHaveBeenCalledOnce();
  });
});
