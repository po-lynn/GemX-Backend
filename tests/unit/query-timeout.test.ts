import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { withQueryTimeout, QueryTimeoutError } from "@/lib/query-timeout"

describe("withQueryTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // Validates the common case: a normal query resolves before the deadline
  it("resolves with the value when the promise settles before the timeout", async () => {
    const result = await withQueryTimeout(Promise.resolve("ok"), 5000, "test-query")
    expect(result).toBe("ok")
  })

  // Validates the original rejection reason is preserved (not masked as a timeout)
  // when the query itself fails fast
  it("propagates the original rejection when the promise rejects before the timeout", async () => {
    await expect(
      withQueryTimeout(Promise.reject(new Error("db boom")), 5000, "test-query")
    ).rejects.toThrow("db boom")
  })

  // Validates a hung query is converted into a QueryTimeoutError once the deadline elapses,
  // instead of leaving the caller waiting indefinitely
  it("rejects with QueryTimeoutError once the deadline elapses on a hung promise", async () => {
    const neverResolves = new Promise(() => {})
    const race = withQueryTimeout(neverResolves, 6000, "products-list")

    const assertion = expect(race).rejects.toBeInstanceOf(QueryTimeoutError)
    await vi.advanceTimersByTimeAsync(6000)
    await assertion
  })

  // Validates the timeout error message names the query so logs can identify which call hung
  it("includes the label and duration in the timeout error message", async () => {
    const neverResolves = new Promise(() => {})
    const race = withQueryTimeout(neverResolves, 1234, "news-category-counts")
    const assertion = race.catch((e) => e)
    await vi.advanceTimersByTimeAsync(1234)
    const error = await assertion
    expect(error).toBeInstanceOf(QueryTimeoutError)
    expect((error as Error).message).toContain("news-category-counts")
    expect((error as Error).message).toContain("1234ms")
  })
})
