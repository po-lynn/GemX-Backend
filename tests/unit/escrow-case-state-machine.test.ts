import { describe, expect, it } from "vitest"
import {
  assertValidTransition,
  canTransition,
  EscrowCaseStateError,
  getValidNextStates,
  isTerminalState,
  type EscrowCaseState,
} from "@/features/escrow-cases/lib/state-machine"

const LINEAR_PATH: EscrowCaseState[] = [
  "requested",
  "agent_assigned",
  "verification",
  "payment_pending",
  "handover_scheduled",
  "handover_confirmed",
  "completed",
]

const OFF_RAMPS: EscrowCaseState[] = ["cancelled", "rejected", "disputed"]
const TERMINAL_STATES: EscrowCaseState[] = ["completed", "cancelled", "rejected", "disputed"]

describe("canTransition", () => {
  // Every consecutive pair in the documented lifecycle must be a valid forward step.
  it("allows every consecutive step of the linear happy path", () => {
    for (let i = 0; i < LINEAR_PATH.length - 1; i++) {
      expect(canTransition(LINEAR_PATH[i], LINEAR_PATH[i + 1])).toBe(true)
    }
  })

  // Skipping a step (e.g. requested -> payment_pending) must never be allowed.
  it("rejects skipping ahead in the linear path", () => {
    expect(canTransition("requested", "payment_pending")).toBe(false)
    expect(canTransition("verification", "handover_confirmed")).toBe(false)
  })

  // Rejects moving backwards along the happy path.
  it("rejects moving backwards", () => {
    expect(canTransition("verification", "agent_assigned")).toBe(false)
    expect(canTransition("completed", "handover_confirmed")).toBe(false)
  })

  // cancelled/rejected/disputed are off-ramps reachable from any in-flight state.
  it("allows every off-ramp from every non-terminal in-flight state", () => {
    const inFlight = LINEAR_PATH.filter((s) => !TERMINAL_STATES.includes(s))
    for (const from of inFlight) {
      for (const to of OFF_RAMPS) {
        expect(canTransition(from, to)).toBe(true)
      }
    }
  })

  // Terminal states (including disputed, treated as terminal for this MVP) have no
  // outgoing transitions at all.
  it("disallows any transition out of a terminal state", () => {
    for (const from of TERMINAL_STATES) {
      for (const to of [...LINEAR_PATH, ...OFF_RAMPS]) {
        if (from === to) continue
        expect(canTransition(from, to)).toBe(false)
      }
    }
  })
})

describe("assertValidTransition", () => {
  // Valid transitions do not throw.
  it("does not throw for a valid transition", () => {
    expect(() => assertValidTransition("requested", "agent_assigned")).not.toThrow()
  })

  // Invalid transitions throw a typed, informative error.
  it("throws EscrowCaseStateError for an invalid transition", () => {
    expect(() => assertValidTransition("completed", "requested")).toThrow(EscrowCaseStateError)
    try {
      assertValidTransition("completed", "requested")
    } catch (err) {
      expect(err).toBeInstanceOf(EscrowCaseStateError)
      expect((err as EscrowCaseStateError).from).toBe("completed")
      expect((err as EscrowCaseStateError).to).toBe("requested")
    }
  })
})

describe("isTerminalState", () => {
  it("identifies all four terminal states", () => {
    for (const state of TERMINAL_STATES) {
      expect(isTerminalState(state)).toBe(true)
    }
  })

  it("identifies in-flight states as non-terminal", () => {
    for (const state of LINEAR_PATH.filter((s) => !TERMINAL_STATES.includes(s))) {
      expect(isTerminalState(state)).toBe(false)
    }
  })
})

describe("getValidNextStates", () => {
  // The UI's transition picker must never offer "agent_assigned" — that state is only
  // ever reached via the dedicated assign endpoint, not the generic transition one.
  it("never includes agent_assigned, even from requested", () => {
    expect(getValidNextStates("requested")).not.toContain("agent_assigned")
  })

  it("returns the linear next step plus all three off-ramps for an in-flight state", () => {
    const next = getValidNextStates("verification")
    expect(next).toEqual(expect.arrayContaining(["payment_pending", "cancelled", "rejected", "disputed"]))
    expect(next).toHaveLength(4)
  })

  it("returns an empty list for a terminal state", () => {
    for (const state of TERMINAL_STATES) {
      expect(getValidNextStates(state)).toEqual([])
    }
  })
})
