import { describe, it, expect } from "vitest"
import { NRC_STATES, NRC_TOWNSHIPS_BY_STATE, NRC_TOWNSHIP_COUNT } from "@/features/users/data/nrc-townships"
import { validateNrc, NRC_CITIZEN_TYPES_MM, toMyanmarDigits } from "@/lib/nrc"

describe("nrc-townships (derived from features/users/data/nrc-townships-mm.json)", () => {
  // NrcField (the admin "create/edit user" NRC picker) builds
  // `${state}/${township}(${type})${number}` (all in Myanmar script) directly from these
  // exports. lib/nrc.ts's NRC_REGEX requires the Myanmar-script township segment to be 1-10
  // Myanmar Unicode characters — any entry outside that shape makes the picker produce an NRC
  // that always fails validation.
  it("has exactly 14 states, each with a non-empty township list", () => {
    expect(NRC_STATES).toHaveLength(14)
    for (const s of NRC_STATES) {
      expect(NRC_TOWNSHIPS_BY_STATE[s.value]?.length ?? 0).toBeGreaterThan(0)
      expect(s.nameMm.trim().length).toBeGreaterThan(0)
      expect(s.nameShortMm.trim().length).toBeGreaterThan(0)
    }
  })

  it("states are sorted by state number, 1 through 14", () => {
    expect(NRC_STATES.map((s) => s.value)).toEqual(
      Array.from({ length: 14 }, (_, i) => String(i + 1))
    )
  })

  it("NRC_TOWNSHIP_COUNT matches the total number of townships across all states", () => {
    const total = Object.values(NRC_TOWNSHIPS_BY_STATE).reduce((n, list) => n + list.length, 0)
    expect(NRC_TOWNSHIP_COUNT).toBe(total)
  })

  it("every township code is 1-10 Myanmar Unicode characters", () => {
    for (const [state, list] of Object.entries(NRC_TOWNSHIPS_BY_STATE)) {
      for (const t of list) {
        expect(t.code, `state ${state} township "${t.name}" -> "${t.code}"`).toMatch(/^[က-႟]{1,10}$/)
      }
    }
  })

  it("every township, combined with each citizen type (Myanmar digits + word), forms a valid NRC", () => {
    for (const [state, list] of Object.entries(NRC_TOWNSHIPS_BY_STATE)) {
      for (const t of list) {
        for (const typeMm of Object.values(NRC_CITIZEN_TYPES_MM)) {
          const nrc = `${toMyanmarDigits(state)}/${t.code}(${typeMm})${toMyanmarDigits("123456")}`
          expect(validateNrc(nrc), nrc).toBe(true)
        }
      }
    }
  })

  it("every township has a non-empty name", () => {
    for (const list of Object.values(NRC_TOWNSHIPS_BY_STATE)) {
      for (const t of list) {
        expect(t.name.trim().length).toBeGreaterThan(0)
      }
    }
  })
})
