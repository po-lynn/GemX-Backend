export type PushErrorCode =
  | "FCM_NOT_CONFIGURED"
  | "INVALID_PAYLOAD"
  | "FCM_SEND_FAILED"
  | "UNKNOWN";

export type PushNotificationError = {
  code: PushErrorCode;
  message: string;
  cause?: string;
};

export function createPushError(
  code: PushErrorCode,
  message: string,
  cause?: unknown
): PushNotificationError {
  return {
    code,
    message,
    cause: cause instanceof Error ? cause.message : cause != null ? String(cause) : undefined,
  };
}

/** Map Firebase Admin SDK errors to stable app error codes. */
export function normalizeFirebaseError(error: unknown): PushNotificationError {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: string }).code);
    const message = String((error as { message?: string }).message ?? "FCM request failed");
    return createPushError("FCM_SEND_FAILED", message, code);
  }
  return createPushError(
    "FCM_SEND_FAILED",
    error instanceof Error ? error.message : "FCM request failed",
    error
  );
}
