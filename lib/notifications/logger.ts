type LogMeta = Record<string, unknown>;

function formatMeta(meta?: LogMeta): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return "";
  }
}

/** Client-side notification logging (browser console). */
export const webPushLogger = {
  info(message: string, meta?: LogMeta): void {
    if (typeof console !== "undefined") {
      console.info(`[web-push] ${message}${formatMeta(meta)}`);
    }
  },
  warn(message: string, meta?: LogMeta): void {
    if (typeof console !== "undefined") {
      console.warn(`[web-push] ${message}${formatMeta(meta)}`);
    }
  },
  error(message: string, meta?: LogMeta): void {
    if (typeof console !== "undefined") {
      console.error(`[web-push] ${message}${formatMeta(meta)}`);
    }
  },
};
