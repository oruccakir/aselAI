import { getAcpClient } from "@/lib/acp/backend";
import { splitChatId } from "@/lib/acp/chat-id";
import type { AcpUpdate } from "@/lib/acp/client";
import { acpUpdatesToUIMessages } from "@/lib/acp/session-display";
import { ChatbotError } from "@/lib/errors";

// Talks to the ACP child process — must run on the Node.js runtime.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId") ?? "";

  const split = splitChatId(chatId);
  if (!split) {
    return new ChatbotError(
      "bad_request:chat",
      `Invalid chat id: ${chatId}`
    ).toResponse();
  }

  try {
    const client = getAcpClient(split.agentId);
    const updates: AcpUpdate[] = [];
    await client.loadSession(split.sessionId, {
      onUpdate: (update) => updates.push(update),
      signal: request.signal,
    });

    return Response.json({
      isReadonly: false,
      messages: acpUpdatesToUIMessages(updates),
      visibility: "private",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Session not found")) {
      return new ChatbotError("not_found:chat", message).toResponse();
    }
    return new ChatbotError("bad_request:chat", message).toResponse();
  }
}
