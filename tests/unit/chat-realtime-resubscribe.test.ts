import { beforeEach, describe, expect, it, vi } from "vitest";

const channelMock = {
  on: vi.fn(),
  subscribe: vi.fn(),
};
const supabaseMock = {
  channel: vi.fn(() => channelMock),
  removeChannel: vi.fn(),
};

vi.mock("@/lib/supabase/browser", () => ({
  getSupabaseBrowserClient: vi.fn(() => supabaseMock),
}));

const { createMessagesRealtimeService } = await import(
  "@/features/chat/realtime/messages-realtime-service"
);

describe("MessagesRealtimeService (re)subscribe hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelMock.on.mockReturnValue(channelMock);
  });

  // Validates that consumers get a resync signal on every (re)connect, since
  // Broadcast events sent while the socket was down are silently lost.
  it("fires onResubscribe on SUBSCRIBED and onSubscriptionError on CHANNEL_ERROR", () => {
    let statusCallback: ((status: string) => void) | undefined;
    channelMock.subscribe.mockImplementation((cb: (status: string) => void) => {
      statusCallback = cb;
      return channelMock;
    });

    const service = createMessagesRealtimeService("user-1");
    expect(service).not.toBeNull();

    const onResubscribe = vi.fn();
    const onSubscriptionError = vi.fn();
    service!.subscribe({ onResubscribe, onSubscriptionError });

    expect(statusCallback).toBeDefined();

    statusCallback!("SUBSCRIBED");
    expect(onResubscribe).toHaveBeenCalledTimes(1);

    statusCallback!("CHANNEL_ERROR");
    expect(onSubscriptionError).toHaveBeenCalledWith("chat:user-1", "CHANNEL_ERROR");

    // Reconnect after the error → consumers must resync again.
    statusCallback!("SUBSCRIBED");
    expect(onResubscribe).toHaveBeenCalledTimes(2);
  });

  // Validates that a throwing consumer callback does not break the subscription flow.
  it("swallows onResubscribe handler errors", () => {
    let statusCallback: ((status: string) => void) | undefined;
    channelMock.subscribe.mockImplementation((cb: (status: string) => void) => {
      statusCallback = cb;
      return channelMock;
    });

    const service = createMessagesRealtimeService("user-1");
    service!.subscribe({
      onResubscribe: () => {
        throw new Error("boom");
      },
    });

    expect(() => statusCallback!("SUBSCRIBED")).not.toThrow();
  });
});
