import { describe, it, expect } from "vitest"
import { buildFacebookShareUrl, buildTelegramShareUrl } from "@/lib/share-links"

describe("buildFacebookShareUrl", () => {
  // The target URL is percent-encoded into Facebook's sharer query param
  it("encodes the URL into the sharer query param", () => {
    const url = buildFacebookShareUrl("https://gemx.example.com/articles/abc?ref=admin")
    expect(url).toBe(
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fgemx.example.com%2Farticles%2Fabc%3Fref%3Dadmin"
    )
  })

  // An empty URL still produces a well-formed (if useless) link, never throws
  it("does not throw for an empty string", () => {
    expect(() => buildFacebookShareUrl("")).not.toThrow()
  })
})

describe("buildTelegramShareUrl", () => {
  // Both the URL and title are percent-encoded, joined with & into Telegram's share params
  it("encodes both the url and title into Telegram's share params", () => {
    const url = buildTelegramShareUrl("https://gemx.example.com/news/xyz", "Big News & Updates")
    expect(url).toBe(
      "https://t.me/share/url?url=https%3A%2F%2Fgemx.example.com%2Fnews%2Fxyz&text=Big%20News%20%26%20Updates"
    )
  })

  // An empty title still produces a well-formed link, never throws
  it("does not throw for an empty title", () => {
    expect(() => buildTelegramShareUrl("https://gemx.example.com/news/xyz", "")).not.toThrow()
  })
})
