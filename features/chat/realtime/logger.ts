type LogMeta = Record<string, unknown>;

function formatMeta(meta?: LogMeta): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return "";
  }
}

export const chatRealtimeLogger = {
  info(message: string, meta?: LogMeta): void {
    console.info(`[chat-realtime] ${message}${formatMeta(meta)}`);
  },
  warn(message: string, meta?: LogMeta): void {
    console.warn(`[chat-realtime] ${message}${formatMeta(meta)}`);
  },
  error(message: string, meta?: LogMeta): void {
    console.error(`[chat-realtime] ${message}${formatMeta(meta)}`);
  },
};
