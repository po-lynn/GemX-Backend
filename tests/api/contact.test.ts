import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { db } from "@/drizzle/db"
import { messages } from "@/drizzle/schema/chat-schema"
import { getEscrowServiceChatUser } from "@/features/escrow-service-settings/db/escrow-service-settings"
import { sendChatMessageNotification } from "@/features/notifications/services/chat-notifications"
import { broadcastChatEvents } from "@/lib/supabase/chat-broadcast"
import { CONTACT_SYSTEM_USER_ID } from "@/features/contact/constants"
import { POST } from "@/app/api/contact/route"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/drizzle/db", () => ({ db: { insert: vi.fn() } }))
vi.mock("@/features/escrow-service-settings/db/escrow-service-settings", () => ({
  getEscrowServiceChatUser: vi.fn(),
}))
vi.mock("@/features/notifications/services/chat-notifications", () => ({
  sendChatMessageNotification: vi.fn().mockResolvedValue({ sent: true }),
}))
vi.mock("@/lib/supabase/chat-broadcast", () => ({
  broadcastChatEvents: vi.fn().mockResolvedValue(undefined),
}))

function insertChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  chain.values = vi.fn(() => chain)
  chain.returning = vi.fn(() => Promise.resolve(result))
  return chain
}

/** Routes db.insert(table) to a different mock result depending on which table is targeted. */
function mockInsert(contactResult: unknown, messageResult: unknown = []) {
  vi.mocked(db.insert).mockImplementation((table: unknown) => {
    if (table === messages) return insertChain(messageResult) as never
    return insertChain(contactResult) as never
  })
}

function postRequest(body: unknown, ip = "1.2.3.4") {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  }) as NextRequest
}

describe("POST /api/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getEscrowServiceChatUser).mockResolvedValue({
      configured: false,
      user: null,
      serviceFee: "0.00",
      serviceOverview: "",
    })
  })

  it("stores a valid submission and returns its id/createdAt", async () => {
    const createdAt = new Date("2026-07-28T10:47:06.000Z")
    mockInsert([{ id: "msg-1", createdAt }])

    const res = await POST(
      postRequest({ name: "PO", email: "po2g@gmail.com", message: "Hello" }, "9.9.9.1")
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true, id: "msg-1", createdAt: createdAt.toISOString() })
    expect(db.insert).toHaveBeenCalledTimes(1)
  })

  it("trims fields before inserting", async () => {
    const createdAt = new Date()
    mockInsert([{ id: "msg-2", createdAt }])

    await POST(
      postRequest(
        { name: "  PO  ", email: "  po2g@gmail.com  ", message: "  Hello  " },
        "9.9.9.2"
      )
    )

    const chain = vi.mocked(db.insert).mock.results[0].value as { values: ReturnType<typeof vi.fn> }
    expect(chain.values).toHaveBeenCalledWith({
      name: "PO",
      email: "po2g@gmail.com",
      message: "Hello",
      status: "pending",
    })
  })

  it("returns 400 when a required field is missing", async () => {
    const res = await POST(postRequest({ name: "PO", email: "po2g@gmail.com" }, "9.9.9.3"))
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("returns 400 for an invalid email", async () => {
    const res = await POST(
      postRequest({ name: "PO", email: "not-an-email", message: "Hi" }, "9.9.9.4")
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/email/i)
  })

  it("returns 500 when the insert fails to return a row", async () => {
    mockInsert([])
    const res = await POST(
      postRequest({ name: "PO", email: "po2g@gmail.com", message: "Hello" }, "9.9.9.5")
    )
    expect(res.status).toBe(500)
  })

  it("rate-limits repeated submissions from the same IP", async () => {
    mockInsert([{ id: "x", createdAt: new Date() }])
    const ip = "9.9.9.6"
    const body = { name: "PO", email: "po2g@gmail.com", message: "Hello" }

    for (let i = 0; i < 5; i++) {
      const res = await POST(postRequest(body, ip))
      expect(res.status).toBe(200)
    }

    const limited = await POST(postRequest(body, ip))
    expect(limited.status).toBe(429)
    expect(limited.headers.get("Retry-After")).toBeTruthy()
  })

  it("does not touch chat when no escrow officer is configured", async () => {
    mockInsert([{ id: "msg-9", createdAt: new Date() }])
    vi.mocked(getEscrowServiceChatUser).mockResolvedValue({
      configured: false,
      user: null,
      serviceFee: "0.00",
      serviceOverview: "",
    })

    await POST(postRequest({ name: "PO", email: "po2g@gmail.com", message: "Hello" }, "9.9.9.7"))

    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(sendChatMessageNotification).not.toHaveBeenCalled()
    expect(broadcastChatEvents).not.toHaveBeenCalled()
  })

  it("delivers the submission into the assigned escrow officer's chat", async () => {
    const contactCreatedAt = new Date("2026-07-28T10:47:06.000Z")
    const chatCreatedAt = new Date("2026-07-28T10:47:06.500Z")
    mockInsert(
      [{ id: "contact-1", createdAt: contactCreatedAt }],
      [
        {
          id: "chat-msg-1",
          senderId: CONTACT_SYSTEM_USER_ID,
          recipientId: "officer-1",
          content: "New contact form message\nFrom: PO (po2g@gmail.com)\n\nHello",
          fileUrl: null,
          imageUrls: null,
          messageType: "text",
          isRead: false,
          starred: false,
          editedAt: null,
          createdAt: chatCreatedAt,
        },
      ]
    )
    vi.mocked(getEscrowServiceChatUser).mockResolvedValue({
      configured: true,
      user: { id: "officer-1", name: "Supervisor", image: null, role: "internal" },
      serviceFee: "2.00",
      serviceOverview: "",
    })

    const res = await POST(
      postRequest({ name: "PO", email: "po2g@gmail.com", message: "Hello" }, "9.9.9.8")
    )

    expect(res.status).toBe(200)
    expect(db.insert).toHaveBeenCalledTimes(2)

    const chatChain = vi.mocked(db.insert).mock.results[1].value as { values: ReturnType<typeof vi.fn> }
    expect(chatChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: CONTACT_SYSTEM_USER_ID,
        recipientId: "officer-1",
        content: "New contact form message\nFrom: PO (po2g@gmail.com)\n\nHello",
      })
    )
    expect(sendChatMessageNotification).toHaveBeenCalledWith(
      expect.objectContaining({ senderId: CONTACT_SYSTEM_USER_ID, recipientId: "officer-1" })
    )
    expect(broadcastChatEvents).toHaveBeenCalledWith([
      expect.objectContaining({ userId: "officer-1", event: "new_message" }),
    ])
  })
})
