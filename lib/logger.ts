type LogMeta = Record<string, unknown>

function formatMeta(meta?: LogMeta): string {
  if (!meta || Object.keys(meta).length === 0) return ""
  try {
    return ` ${JSON.stringify(meta)}`
  } catch {
    return ""
  }
}

export function createLogger(prefix: string) {
  return {
    info(message: string, meta?: LogMeta): void {
      console.info(`[${prefix}] ${message}${formatMeta(meta)}`)
    },
    warn(message: string, meta?: LogMeta): void {
      console.warn(`[${prefix}] ${message}${formatMeta(meta)}`)
    },
    error(message: string, meta?: LogMeta): void {
      console.error(`[${prefix}] ${message}${formatMeta(meta)}`)
    },
  }
}
