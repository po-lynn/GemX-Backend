import { NextRequest, connection } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { messages } from "@/drizzle/schema/chat-schema";
import { messageReport } from "@/drizzle/schema/chat-moderation-schema";
import { jsonError, jsonUncached } from "@/lib/api";
import { createMessageReport } from "@/features/chat-moderation/db/reports";

const bodySchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

function messageSnapshot(row: { content: string; imageUrls: string[] | null; messageType: string }): string {
  if (row.content?.trim()) return row.content;
  if (row.imageUrls?.length) return "Sent photos";
  if (row.messageType === "audio") return "Sent a voice message";
  if (row.messageType === "file") return "Sent a file";
  return "New message";
}

/**
 * POST /api/chat/messages/[messageId]/report
 * The end-user counterpart to the admin-only POST /api/admin/chat-moderation/reports
 * (which files a report while a moderator is reviewing a thread). This is the mobile/web
 * "report this message" action: only a participant (sender or recipient) of the message
 * may file it, so the reporter can't report messages they were never party to. Returns
 * the existing report id (rather than inserting a duplicate) if this reporter already
 * has an open report against the same message.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ messageId: string }> }
) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const { messageId } = await context.params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError("Invalid input", 400);

    const reporterId = session.user.id;

    const [row] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
    // Not a participant sees the same 404 as a nonexistent message — never reveals
    // whether a message id exists to someone who isn't part of that conversation.
    if (!row || (row.senderId !== reporterId && row.recipientId !== reporterId)) {
      return jsonError("Message not found", 404);
    }

    const [existing] = await db
      .select({ id: messageReport.id })
      .from(messageReport)
      .where(
        and(
          eq(messageReport.flatMessageId, messageId),
          eq(messageReport.reporterId, reporterId),
          or(eq(messageReport.status, "open"), eq(messageReport.status, "actioned"))
        )
      )
      .limit(1);
    if (existing) {
      return jsonUncached({ success: true, report: existing, alreadyReported: true });
    }

    const report = await createMessageReport({
      flatMessageId: messageId,
      reporterId,
      reason: parsed.data.reason,
      contentSnapshot: messageSnapshot(row),
    });

    return jsonUncached({ success: true, report });
  } catch (error) {
    console.error("POST /api/chat/messages/[messageId]/report:", error);
    return jsonError("Failed to report message", 500);
  }
}
