/**
 * Placeholder sender for monthly-bonus chat notices.
 * Seeded by `scripts/create-gemx-notifications-system-user.sql`.
 * No `account` row — cannot sign in; banned+archived hide it from pickers.
 */
export const GEMX_NOTIFICATIONS_SYSTEM_USER_ID = "sys-gemx-notifications"

export const GEMX_NOTIFICATIONS_SYSTEM_USER_NAME = "GemX"

export type MonthlyBonusNotifyLocale = "en" | "my" | "th" | "ko"

type LocalizedCopy = {
  title: string
  /** Body with `{amount}` replaced by the granted point amount. */
  body: (amount: number) => string
}

/**
 * Localized title/body for monthly bonus notices.
 * Runtime currently sends English only (no user language preference yet).
 */
export const MONTHLY_BONUS_NOTIFY_COPY: Record<
  MonthlyBonusNotifyLocale,
  LocalizedCopy
> = {
  en: {
    title: "Your monthly bonus points have arrived! 🗓️",
    body: (amount) =>
      `Your monthly drop of ${amount} points is ready. Check your updated points balance now.`,
  },
  my: {
    title: "သင့်လစဉ်အပိုဆုမှတ်များ ရောက်ရှိပါပြီ! 🗓️",
    body: (amount) =>
      `သင့်လစဉ် ${amount} မှတ် အပိုဆု ရရှိရန် အဆင်သင့်ဖြစ်ပါပြီ။ ယခု သင့်မှတ်လက်ကျန်ကို စစ်ဆေးပါ။`,
  },
  th: {
    title: "คะแนนโบนัสรายเดือนของคุณมาถึงแล้ว! 🗓️",
    body: (amount) =>
      `คะแนนโบนัสรายเดือน ${amount} คะแนนของคุณพร้อมแล้ว ตรวจสอบยอดคะแนนของคุณได้เลย`,
  },
  ko: {
    title: "월간 보너스 포인트가 도착했습니다! 🗓️",
    body: (amount) =>
      `이번 달 ${amount} 포인트 보너스가 지급되었습니다. 지금 포인트 잔액을 확인해 보세요.`,
  },
}

export function getMonthlyBonusNotifyCopy(
  amount: number,
  locale: MonthlyBonusNotifyLocale = "en",
): { title: string; body: string; content: string } {
  const copy = MONTHLY_BONUS_NOTIFY_COPY[locale] ?? MONTHLY_BONUS_NOTIFY_COPY.en
  const title = copy.title
  const body = copy.body(amount)
  return {
    title,
    body,
    content: `${title}\n\n${body}`,
  }
}
