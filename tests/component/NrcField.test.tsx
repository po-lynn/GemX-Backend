import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { NrcField } from "@/features/users/components/NrcField"
import { NRC_TOWNSHIPS_BY_STATE } from "@/features/users/data/nrc-townships"

afterEach(cleanup)

describe("NrcField", () => {
  // Picking a state auto-selects that state's first township (sorted by code) and never leaves
  // an impossible (state, township) pair selectable — see design_handoff_nrc_field/README.md.
  it("auto-selects the first township of a state when the state changes", () => {
    const onChange = vi.fn()
    render(
      <NrcField value={{ state: "", township: "", type: "N", number: "" }} onChange={onChange} />
    )
    const select = screen.getByRole("combobox") as HTMLSelectElement
    fireEvent.change(select, { target: { value: "9" } })

    const expectedFirst = NRC_TOWNSHIPS_BY_STATE["9"][0].code
    expect(onChange).toHaveBeenCalledWith({ state: "9", township: expectedFirst, type: "N", number: "" })
  })

  it("keeps an existing township that isn't in the canonical list instead of dropping it", () => {
    render(
      <NrcField
        value={{ state: "9", township: "ဆလလ", type: "N", number: "123456" }}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText("ဆလလ")).toBeInTheDocument()
    expect(screen.getByText("Unrecognized township code")).toBeInTheDocument()
  })

  it("opening the township popover and picking a row updates the value and closes it", () => {
    const onChange = vi.fn()
    const first = NRC_TOWNSHIPS_BY_STATE["9"][0]
    const second = NRC_TOWNSHIPS_BY_STATE["9"][1]
    render(
      <NrcField value={{ state: "9", township: first.code, type: "N", number: "" }} onChange={onChange} />
    )
    fireEvent.click(screen.getByRole("button", { name: new RegExp(first.name) }))
    fireEvent.click(screen.getByText(second.name))
    expect(onChange).toHaveBeenCalledWith({ state: "9", township: second.code, type: "N", number: "" })
    expect(screen.queryByPlaceholderText("ကမရ or ကျိုက်မရော")).not.toBeInTheDocument()
  })

  it("filters the township list by a search query matching code or name", () => {
    const first = NRC_TOWNSHIPS_BY_STATE["9"][0]
    render(
      <NrcField value={{ state: "9", township: first.code, type: "N", number: "" }} onChange={vi.fn()} />
    )
    fireEvent.click(screen.getByRole("button", { name: new RegExp(first.name) }))
    const search = screen.getByPlaceholderText("ကမရ or ကျိုက်မရော")
    fireEvent.change(search, { target: { value: "ZZZNOPE" } })
    expect(screen.getByText("No township code matches that search inside this state.")).toBeInTheDocument()
  })

  it("strips non-digits and caps the number at 6 characters", () => {
    const onChange = vi.fn()
    render(
      <NrcField value={{ state: "9", township: "", type: "N", number: "" }} onChange={onChange} />
    )
    const number = screen.getByPlaceholderText("123456")
    fireEvent.change(number, { target: { value: "12ab34567" } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ number: "123456" }))
  })

  it("selecting a citizenship type updates the value", () => {
    const onChange = vi.fn()
    render(
      <NrcField value={{ state: "9", township: "", type: "N", number: "" }} onChange={onChange} />
    )
    fireEvent.click(screen.getByRole("button", { name: "ပြု" }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: "P" }))
  })

  it("shows the assembled Myanmar NRC and marks it ready once all four parts are filled", () => {
    const first = NRC_TOWNSHIPS_BY_STATE["9"][0]
    render(
      <NrcField
        value={{ state: "9", township: first.code, type: "N", number: "123456" }}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText(`၉/${first.code}(နိုင်)၁၂၃၄၅၆`)).toBeInTheDocument()
    expect(screen.getByText("Ready for KYC review")).toBeInTheDocument()
  })

  it("marks the NRC incomplete when the number is short", () => {
    const first = NRC_TOWNSHIPS_BY_STATE["9"][0]
    render(
      <NrcField
        value={{ state: "9", township: first.code, type: "N", number: "123" }}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText("Incomplete")).toBeInTheDocument()
    expect(screen.getByText("Needs six digits")).toBeInTheDocument()
  })
})
