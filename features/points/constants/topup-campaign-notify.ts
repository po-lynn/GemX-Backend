export type TopUpCampaignNotifyLocale = "en" | "my" | "th" | "ko"

type LocalizedCopy = {
  title: string
  body: (amount: number, campaignName: string) => string
}

/** Runtime currently sends English only (no user language preference yet). */
export const TOPUP_CAMPAIGN_NOTIFY_COPY: Record<
  TopUpCampaignNotifyLocale,
  LocalizedCopy
> = {
  en: {
    title: "You've received bonus points! 🎁",
    body: (amount, campaignName) =>
      `You've been credited ${amount.toLocaleString()} points from "${campaignName}". Check your updated balance now.`,
  },
  my: {
    title: "အပိုဆုမှတ်များ ရရှိပါပြီ! 🎁",
    body: (amount, campaignName) =>
      `"${campaignName}" ကမ်ပိန်း မှ ${amount.toLocaleString()} မှတ် ရရှိပါပြီ။ ယခု သင့်မှတ်လက်ကျန်ကို စစ်ဆေးပါ။`,
  },
  th: {
    title: "คุณได้รับคะแนนโบนัสแล้ว! 🎁",
    body: (amount, campaignName) =>
      `คุณได้รับ ${amount.toLocaleString()} คะแนนจาก "${campaignName}" แล้ว ตรวจสอบยอดคะแนนของคุณได้เลย`,
  },
  ko: {
    title: "보너스 포인트가 지급되었습니다! 🎁",
    body: (amount, campaignName) =>
      `"${campaignName}" 캠페인에서 ${amount.toLocaleString()} 포인트가 지급되었습니다. 지금 잔액을 확인해 보세요.`,
  },
}

export function getTopUpCampaignNotifyCopy(
  amount: number,
  campaignName: string,
  locale: TopUpCampaignNotifyLocale = "en",
): { title: string; body: string; content: string } {
  const copy = TOPUP_CAMPAIGN_NOTIFY_COPY[locale] ?? TOPUP_CAMPAIGN_NOTIFY_COPY.en
  const title = copy.title
  const body = copy.body(amount, campaignName)
  return { title, body, content: `${title}\n\n${body}` }
}
