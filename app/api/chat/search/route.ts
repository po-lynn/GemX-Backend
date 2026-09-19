import { NextRequest, connection } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { jsonError, jsonUncached } from "@/lib/api";
import { withQueryTimeout, QueryTimeoutError } from "@/lib/query-timeout";
import { searchChatMessages } from "@/features/chat/db/message-search";
import { rateLimit } from "@/lib/rate-limit";

const querySchema = z.object({
  q: z.string().trim().min(2).max(200),
  peerId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

/** Vercel backstop: if a query hangs past this, the platform kills the invocation instead of it running to the plan default. */
export const maxDuration = 10;

const CHAT_SEARCH_QUERY_TIMEOUT_MS = 6000;

// In-memory, not DB-counted like the send-rate-limit checks: this is a read endpoint, and
// the whole point is keeping its own hot-path cost down, so adding a DB round trip just to
// rate-limit it would be self-defeating. Per-instance-only (not shared across Vercel
// instances) is an accepted trade-off for a soft cap on a read endpoint — see lib/rate-limit.ts.
const SEARCH_RATE_LIMIT_MAX = 20;
const SEARCH_RATE_LIMIT_WINDOW_MS = 60_000;

function jsonTimeout(message: string): Response {
  return Response.json(
    { error: message },
    { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3" } }
  );
}

/**
 * GET /api/chat/search?q=&peerId=&page=&limit=
 * Full-text search over the caller's own flat-chat history (see message-search.ts's
 * header comment for why this doesn't cover escrow-case threads). `peerId` narrows the
 * search to one conversation; omitted, it searches across every peer.
 */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const rl = rateLimit(`chat-search:${session.user.id}`, SEARCH_RATE_LIMIT_MAX, SEARCH_RATE_LIMIT_WINDOW_MS);
    if (!rl.allowed) {
      return Response.json(
        { error: "Too many searches — please slow down" },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const parsed = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );
    if (!parsed.success) return jsonError("Invalid input", 400);
    const { q, peerId, page, limit } = parsed.data;

    const { results, total } = await withQueryTimeout(
      searchChatMessages(session.user.id, q, { peerId, page, limit }),
      CHAT_SEARCH_QUERY_TIMEOUT_MS,
      "chat-search"
    );

    return jsonUncached({ success: true, results, total, page, limit });
  } catch (error) {
    if (error instanceof QueryTimeoutError) {
      console.error("GET /api/chat/search: timed out:", error.message);
      return jsonTimeout("Search is taking longer than usual — please retry");
    }
    console.error("GET /api/chat/search:", error);
    return jsonError("Failed to search messages", 500);
  }
}
