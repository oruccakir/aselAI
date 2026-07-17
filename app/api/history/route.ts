import { isAcpAgentId } from "@/lib/acp/agents";
import { getAcpClient } from "@/lib/acp/backend";
import { joinChatId } from "@/lib/acp/chat-id";
import { normalizeSessionSummary } from "@/lib/acp/session-display";
import { ChatbotError } from "@/lib/errors";
import type { Chat } from "@/lib/types";

// Talks to the ACP child process — must run on the Node.js runtime.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent") ?? "";
  const cursor = searchParams.get("cursor");

  if (!isAcpAgentId(agentId)) {
    return new ChatbotError(
      "bad_request:history",
      `Unknown agent: ${agentId}`
    ).toResponse();
  }

  try {
    const client = getAcpClient(agentId);
    const { sessions, nextCursor } = await client.listSessions({ cursor });

    const chats: Chat[] = sessions.map((session) => {
      const summary = normalizeSessionSummary(session);
      return {
        createdAt: summary.updatedAt ? new Date(summary.updatedAt) : new Date(),
        id: joinChatId(agentId, summary.id),
        title: summary.title,
        userId: "local-user",
        visibility: "private",
      };
    });

    return Response.json({ chats, hasMore: !!nextCursor, nextCursor });
  } catch (error) {
    return new ChatbotError(
      "bad_request:history",
      error instanceof Error ? error.message : String(error)
    ).toResponse();
  }
}
