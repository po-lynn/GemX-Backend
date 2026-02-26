import { describe, it, expect } from "vitest"
import {
  getPageNumbers,
  ELLIPSIS_PREV,
  ELLIPSIS_NEXT,
} from "@/lib/pagination"

describe("getPageNumbers", () => {
  it("returns empty array when totalPages <= 1", () => {
    expect(getPageNumbers(1, 0)).toEqual([])
    expect(getPageNumbers(1, 1)).toEqual([])
  })

  it("returns [1..N] when totalPages <= 7", () => {
    expect(getPageNumbers(1, 2)).toEqual([1, 2])
    expect(getPageNumbers(2, 5)).toEqual([1, 2, 3, 4, 5])
    expect(getPageNumbers(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("includes ellipsis when totalPages > 7 and page in middle", () => {
    const pages = getPageNumbers(5, 10)
    expect(pages[0]).toBe(1)
    expect(pages).toContain(ELLIPSIS_PREV)
    expect(pages).toContain(4)
    expect(pages).toContain(5)
    expect(pages).toContain(6)
    expect(pages).toContain(ELLIPSIS_NEXT)
    expect(pages[pages.length - 1]).toBe(10)
  })

  it("returns first page, next page, ellipsis, last when page is 1", () => {
    const pages = getPageNumbers(1, 10)
    expect(pages[0]).toBe(1)
    expect(pages).toContain(2)
    expect(pages).toContain(ELLIPSIS_NEXT)
    expect(pages[pages.length - 1]).toBe(10)
    expect(pages).toEqual([1, 2, ELLIPSIS_NEXT, 10])
  })

  it("returns first, ellipsis, last two, last when page is totalPages", () => {
    const pages = getPageNumbers(10, 10)
    expect(pages[0]).toBe(1)
    expect(pages).toContain(ELLIPSIS_PREV)
    expect(pages).toContain(9)
    expect(pages[pages.length - 1]).toBe(10)
  })
})
