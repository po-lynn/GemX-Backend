import { describe, expect, it } from "vitest"
import { buildSystemMessageCopy } from "@/features/escrow-cases/lib/system-message-copy"

describe("buildSystemMessageCopy", () => {
  // Default locale (no third argument) must be English.
  it("defaults to English when no locale is given", () => {
    expect(buildSystemMessageCopy("case_created", {})).toBe("Case opened.")
  })

  it("renders a case_created message in English and Burmese", () => {
    expect(buildSystemMessageCopy("case_created", {}, "en")).toBe("Case opened.")
    expect(buildSystemMessageCopy("case_created", {}, "my")).toContain("အမှုကိစ္စ")
  })

  it("renders a state_changed message naming both states, in English and Burmese", () => {
    const en = buildSystemMessageCopy("state_changed", { from: "requested", to: "verification" }, "en")
    expect(en).toBe('Status changed from "Requested" to "Verification".')

    const my = buildSystemMessageCopy("state_changed", { from: "requested", to: "verification" }, "my")
    expect(my).toContain("တောင်းဆိုထားသည်")
    expect(my).toContain("အတည်ပြုနေဆဲ")
  })

  it("renders an assigned message naming the agent", () => {
    expect(buildSystemMessageCopy("assigned", { agentName: "Aye Aye" }, "en")).toBe(
      "Aye Aye was assigned to this case."
    )
    expect(buildSystemMessageCopy("assigned", { agentName: "Aye Aye" }, "my")).toContain("Aye Aye")
  })

  it("renders a reassigned message with both agent names when there was a previous agent", () => {
    const en = buildSystemMessageCopy("reassigned", { fromAgentName: "Aye Aye", toAgentName: "Zaw Zaw" }, "en")
    expect(en).toBe("This case was reassigned from Aye Aye to Zaw Zaw.")
  })

  // A first-time "reassignment" (fromAgentName null) shouldn't say "from null" — this
  // path is currently unused (setEscrowCaseAgent always sends a real prior name or takes
  // the "assigned" branch instead), but the generator must degrade sensibly if it's ever
  // called this way directly.
  it("omits the 'from' clause when there was no previous agent", () => {
    const en = buildSystemMessageCopy("reassigned", { fromAgentName: null, toAgentName: "Zaw Zaw" }, "en")
    expect(en).toBe("This case was reassigned to Zaw Zaw.")
    expect(en).not.toContain("from")
  })
})
