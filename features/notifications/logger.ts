type LogMeta = Record<string, unknown>;

function formatMeta(meta?: LogMeta): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return "";
  }
}

/** Structured logging for notification services (server). */
export const notificationLogger = {
  info(message: string, meta?: LogMeta): void {
    console.log(`[notifications] INFO ${message}${formatMeta(meta)}`);
  },
  warn(message: string, meta?: LogMeta): void {
    console.warn(`[notifications] WARN ${message}${formatMeta(meta)}`);
  },
  error(message: string, meta?: LogMeta): void {
    console.error(`[notifications] ERROR ${message}${formatMeta(meta)}`);
  },
};
