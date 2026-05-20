import { describe, expect, it } from "vitest";
import { mobileDevicePayloadSchema, registerDeviceBodySchema } from "@/features/notifications/schemas/device";

describe("mobileDevicePayloadSchema", () => {
  // Validates fcmToken alias and legacy `token` field for mobile auth bodies.
  it("accepts fcmToken with device metadata", () => {
    const result = mobileDevicePayloadSchema.parse({
      fcmToken: "abc123",
      platform: "android",
      deviceName: "Pixel 8",
      deviceModel: "Google Pixel 8",
      osVersion: "14",
      appVersion: "1.0.0",
    });
    expect(result.fcmToken).toBe("abc123");
    expect(result.platform).toBe("android");
    expect(result.deviceName).toBe("Pixel 8");
  });

  // Mobile clients may still send `token` from older integrations.
  it("maps legacy token field to fcmToken", () => {
    const result = mobileDevicePayloadSchema.parse({
      token: "legacy-token",
      platform: "ios",
    });
    expect(result.fcmToken).toBe("legacy-token");
  });

  it("returns undefined fcmToken when neither token field is sent", () => {
    const result = mobileDevicePayloadSchema.parse({ platform: "android" });
    expect(result.fcmToken).toBeUndefined();
  });
});

describe("registerDeviceBodySchema", () => {
  it("requires token for POST /api/push/register", () => {
    expect(() => registerDeviceBodySchema.parse({})).toThrow();
    const result = registerDeviceBodySchema.parse({ token: "t1", platform: "ios" });
    expect(result.token).toBe("t1");
  });
});
