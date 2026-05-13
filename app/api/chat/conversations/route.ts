import { NextRequest, connection } from "next/server";
import { auth } from "@/lib/auth";
import { getChatConversationsForUser } from "@/features/chat/db/conversations-list";
import { jsonError, jsonUncached } from "@/lib/api";

const SSE_POLL_DEFAULT_MS = 4_000;
const SSE_POLL_MIN_MS = 2_000;
const SSE_POLL_MAX_MS = 30_000;
const SSE_HEARTBEAT_MS = 25_000;

const textEncoder = new TextEncoder();

function clampPollIntervalMs(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return SSE_POLL_DEFAULT_MS;
  return Math.min(SSE_POLL_MAX_MS, Math.max(SSE_POLL_MIN_MS, Math.floor(n)));
}

/** Long-lived SSE: same auth as JSON GET; opt-in via query so normal clients are unchanged. */
function wantsEventStream(request: NextRequest): boolean {
  const stream = request.nextUrl.searchParams.get("stream");
  return stream === "1" || stream === "true" || stream === "sse";
}

function sseDataLine(obj: unknown): Uint8Array {
  return textEncoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

function sseCommentKeepAlive(): Uint8Array {
  return textEncoder.encode(`: keep-alive\n\n`);
}

/**
 * GET /api/chat/conversations
 * JSON snapshot (default), or **Server-Sent Events** when `?stream=1` (or `stream=true` / `stream=sse`):
 * pushes `{ success, conversations }` whenever the payload changes, plus periodic keep-alive comments.
 *
 * Query (SSE only): `intervalMs` — poll DB between **2000** and **30000** (default **4000**). Lower = fresher
 * `lastMessage` / `lastMessageTime` / `unreadCount` / `isOnline`, at higher DB load.
 */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    if (!wantsEventStream(request)) {
      const conversations = await getChatConversationsForUser(session.user.id);
      return jsonUncached({ success: true, conversations });
    }

    const userId = session.user.id;
    const pollMs = clampPollIntervalMs(request.nextUrl.searchParams.get("intervalMs"));

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let loading = false;
        let lastJson = "";
        let pollTimer: ReturnType<typeof setInterval> | undefined;
        let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

        const close = () => {
          if (closed) return;
          closed = true;
          if (pollTimer) clearInterval(pollTimer);
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          try {
            controller.close();
          } catch {
            // already closed
          }
        };

        const safeEnqueue = (chunk: Uint8Array) => {
          if (closed) return;
          try {
            controller.enqueue(chunk);
          } catch {
            close();
          }
        };

        const tick = async () => {
          if (closed || loading) return;
          loading = true;
          try {
            const conversations = await getChatConversationsForUser(userId);
            if (closed) return;
            const json = JSON.stringify({ success: true as const, conversations });
            if (json !== lastJson) {
              lastJson = json;
              safeEnqueue(sseDataLine({ success: true, conversations }));
            }
          } catch (error) {
            console.error("GET /api/chat/conversations stream tick:", error);
            safeEnqueue(sseDataLine({ success: false, error: "Failed to load conversations" }));
          } finally {
            loading = false;
          }
        };

        void tick().then(() => {
          if (closed) return;
          pollTimer = setInterval(() => void tick(), pollMs);
          heartbeatTimer = setInterval(() => safeEnqueue(sseCommentKeepAlive()), SSE_HEARTBEAT_MS);
        });

        request.signal.addEventListener("abort", close);
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("GET /api/chat/conversations:", error);
    return jsonError("Failed to load conversations", 500);
  }
}
