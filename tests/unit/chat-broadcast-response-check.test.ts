import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Validates broadcastChatEvents/broadcastCaseEvents surface a non-2xx Supabase Realtime
// response as a thrown error — fetch() only rejects on network failure, so without this
// check a rotated service-role key or a Supabase-side outage would silently look
// identical to "recipient was offline," with no error for the caller's `.catch(...)`
// to log.

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  vi.resetModules();
});

describe("broadcastChatEvents", () => {
  it("resolves when the broadcast response is ok", async () => {
    global.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as never;
    const { broadcastChatEvents } = await import("@/lib/supabase/chat-broadcast");

    await expect(
      broadcastChatEvents([{ userId: "u1", event: "new_message", payload: {} as never }])
    ).resolves.toBeUndefined();
  });

  it("throws when the broadcast response is not ok", async () => {
    global.fetch = vi.fn(async () => new Response("unauthorized", { status: 401 })) as never;
    const { broadcastChatEvents } = await import("@/lib/supabase/chat-broadcast");

    await expect(
      broadcastChatEvents([{ userId: "u1", event: "new_message", payload: {} as never }])
    ).rejects.toThrow(/401/);
  });

  it("does not call fetch when there are no targets", async () => {
    global.fetch = vi.fn() as never;
    const { broadcastChatEvents } = await import("@/lib/supabase/chat-broadcast");

    await broadcastChatEvents([]);

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("broadcastCaseEvents", () => {
  it("resolves when the broadcast response is ok", async () => {
    global.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as never;
    const { broadcastCaseEvents } = await import("@/lib/supabase/case-broadcast");

    await expect(
      broadcastCaseEvents("case-1", [{ event: "case_state_changed", payload: { caseId: "case-1", state: "completed" } }])
    ).resolves.toBeUndefined();
  });

  it("throws when the broadcast response is not ok", async () => {
    global.fetch = vi.fn(async () => new Response("server error", { status: 500 })) as never;
    const { broadcastCaseEvents } = await import("@/lib/supabase/case-broadcast");

    await expect(
      broadcastCaseEvents("case-1", [{ event: "case_state_changed", payload: { caseId: "case-1", state: "completed" } }])
    ).rejects.toThrow(/500/);
  });
});
