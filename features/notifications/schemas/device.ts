import { z } from "zod";

const platformSchema = z.enum(["android", "ios"]);

/** Optional device + FCM fields accepted on mobile login/register. */
export const mobileDevicePayloadSchema = z
  .object({
    fcmToken: z.string().trim().min(1).optional(),
    token: z.string().trim().min(1).optional(),
    platform: platformSchema.optional(),
    deviceId: z.string().trim().min(1).optional(),
    deviceName: z.string().trim().min(1).optional(),
    deviceModel: z.string().trim().min(1).optional(),
    osVersion: z.string().trim().min(1).optional(),
    appVersion: z.string().trim().min(1).optional(),
  })
  .transform((data) => ({
    fcmToken: data.fcmToken ?? data.token,
    platform: data.platform,
    deviceId: data.deviceId,
    deviceName: data.deviceName,
    deviceModel: data.deviceModel,
    osVersion: data.osVersion,
    appVersion: data.appVersion,
  }));

export const registerDeviceBodySchema = z.object({
  token: z.string().trim().min(1),
  platform: platformSchema.optional(),
  deviceId: z.string().trim().min(1).optional(),
  deviceName: z.string().trim().min(1).optional(),
  deviceModel: z.string().trim().min(1).optional(),
  osVersion: z.string().trim().min(1).optional(),
  appVersion: z.string().trim().min(1).optional(),
});

export type MobileDevicePayload = z.infer<typeof mobileDevicePayloadSchema>;
export type RegisterDeviceBody = z.infer<typeof registerDeviceBodySchema>;
