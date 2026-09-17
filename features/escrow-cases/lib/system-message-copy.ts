import type { EscrowCaseState } from "@/features/escrow-cases/lib/state-machine"

export type EscrowCaseSystemEventType = "case_created" | "state_changed" | "assigned" | "reassigned"

export type EscrowCaseSystemEventPayload =
  | { from: EscrowCaseState; to: EscrowCaseState }
  | { agentName: string }
  | { fromAgentName: string | null; toAgentName: string }
  | Record<string, never>

/**
 * State labels for system-message copy. Burmese strings are a first-pass, static
 * translation (not run through lib/google-translate.ts, since these are a small fixed
 * set of templates re-rendered on every event, not per-row content translated once at
 * save time like news/product titles) — flag for native-speaker review before these
 * reach a real buyer/seller thread (see docs/technical/escrow-case-messaging.md).
 */
const STATE_LABELS: Record<"en" | "my", Record<EscrowCaseState, string>> = {
  en: {
    requested: "Requested",
    agent_assigned: "Agent assigned",
    verification: "Verification",
    payment_pending: "Payment pending",
    handover_scheduled: "Handover scheduled",
    handover_confirmed: "Handover confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    rejected: "Rejected",
    disputed: "Disputed",
  },
  my: {
    requested: "တောင်းဆိုထားသည်",
    agent_assigned: "အေးဂျင့်တာဝန်ပေးအပ်ပြီး",
    verification: "အတည်ပြုနေဆဲ",
    payment_pending: "ငွေပေးချေမှုစောင့်ဆိုင်းနေဆဲ",
    handover_scheduled: "လွှဲပြောင်းမည့်ရက်သတ်မှတ်ပြီး",
    handover_confirmed: "လွှဲပြောင်းမှုအတည်ပြုပြီး",
    completed: "ပြီးဆုံးပြီ",
    cancelled: "ပယ်ဖျက်ပြီး",
    rejected: "ပယ်ချပြီး",
    disputed: "အငြင်းပွားမှုရှိနေသည်",
  },
}

/**
 * Pure copy generator for escrow-case system messages. `content` on the message row
 * always stores the English rendering (the base/default, matching this admin-first
 * feature); `systemEventType`/`systemEventPayload` are kept on the row so a future
 * buyer/seller-facing surface can re-render the same event in Burmese by calling this
 * again with locale="my", without needing per-locale content columns on every row.
 */
export function buildSystemMessageCopy(
  eventType: EscrowCaseSystemEventType,
  payload: EscrowCaseSystemEventPayload,
  locale: "en" | "my" = "en"
): string {
  const labels = STATE_LABELS[locale]

  switch (eventType) {
    case "case_created":
      return locale === "my" ? "အမှုကိစ္စဖွင့်လှစ်ပြီးပါပြီ။" : "Case opened."

    case "state_changed": {
      const { from, to } = payload as { from: EscrowCaseState; to: EscrowCaseState }
      return locale === "my"
        ? `အခြေအနေ "${labels[from]}" မှ "${labels[to]}" သို့ပြောင်းလဲပါသည်။`
        : `Status changed from "${labels[from]}" to "${labels[to]}".`
    }

    case "assigned": {
      const { agentName } = payload as { agentName: string }
      return locale === "my" ? `${agentName} ကို ဤအမှုကိစ္စအတွက် တာဝန်ပေးအပ်ပါသည်။` : `${agentName} was assigned to this case.`
    }

    case "reassigned": {
      const { fromAgentName, toAgentName } = payload as { fromAgentName: string | null; toAgentName: string }
      if (locale === "my") {
        return fromAgentName
          ? `ဤအမှုကိစ္စကို ${fromAgentName} ထံမှ ${toAgentName} သို့ လွှဲပြောင်းပါသည်။`
          : `ဤအမှုကိစ္စကို ${toAgentName} သို့ လွှဲပြောင်းပါသည်။`
      }
      return fromAgentName
        ? `This case was reassigned from ${fromAgentName} to ${toAgentName}.`
        : `This case was reassigned to ${toAgentName}.`
    }
  }
}
