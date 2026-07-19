import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessageChunk,
} from "ai";
import { z } from "zod";
import { DEFAULT_AGENT_ID, getAcpAgent, isAcpAgentId } from "@/lib/acp/agents";
import { getAcpClient } from "@/lib/acp/backend";
import { joinChatId, splitChatId } from "@/lib/acp/chat-id";
import type { AcpPromptBlock } from "@/lib/acp/client";
import { createAcpUiStreamMapper } from "@/lib/acp/ui-stream";
import { ChatbotError } from "@/lib/errors";

// Talks to the ACP child process (node:child_process) — Node.js runtime
// (the default for route handlers; the "runtime" segment export is
// incompatible with cacheComponents).
export const maxDuration = 300;

const postRequestBodySchema = z.object({
  agentId: z.string().optional(),
  id: z.string().min(1),
  message: z.object({
    parts: z.array(z.record(z.string(), z.unknown())),
    role: z.string(),
  }),
});

function promptBlocksFromParts(
  parts: Record<string, unknown>[]
): AcpPromptBlock[] {
  const blocks: AcpPromptBlock[] = [];
  for (const part of parts) {
    if (part.type === "text" && typeof part.text === "string" && part.text) {
      blocks.push({ text: part.text, type: "text" });
    }
  }
  return blocks;
}

export async function POST(request: Request) {
  let body: z.infer<typeof postRequestBodySchema>;
  try {
    body = postRequestBodySchema.parse(await request.json());
  } catch {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const requestedAgentId = body.agentId ?? DEFAULT_AGENT_ID;
  const split = splitChatId(body.id);
  const agentId = split?.agentId ?? requestedAgentId;
  if (!isAcpAgentId(agentId)) {
    return new ChatbotError(
      "bad_request:api",
      `Unknown agent: ${agentId}`
    ).toResponse();
  }

  const agent = getAcpAgent(agentId);
  const client = getAcpClient(agentId);
  const promptBlocks = promptBlocksFromParts(body.message.parts);
  if (promptBlocks.length === 0) {
    return new ChatbotError(
      "bad_request:api",
      "Message has no text"
    ).toResponse();
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });

      const sessionId = split?.sessionId ?? (await client.newSession());
      if (!split) {
        // Tell the client its real chat id so subsequent sends continue
        // this session instead of creating a new one per message.
        writer.write({
          data: joinChatId(agentId, sessionId),
          transient: true,
          type: "data-session-id",
        } as UIMessageChunk);
      }

      // Latest-wins: cancel a still-running turn for this session and wait
      // for it to settle, so the new prompt is not dropped.
      if (client.isBusy(sessionId)) {
        await client.cancelActivePrompt(sessionId);
      }

      const mapper = createAcpUiStreamMapper(agent);
      await client.prompt(sessionId, promptBlocks, {
        onUpdate: (update) => {
          for (const chunk of mapper.map(update)) {
            writer.write(chunk);
          }
        },
        signal: request.signal,
      });

      for (const chunk of mapper.flush()) {
        writer.write(chunk);
      }
      writer.write({ type: "finish" });
    },
    // The default onError masks everything as "An error occurred."
    onError: (error) =>
      error instanceof Error ? error.message : String(error),
  });

  return createUIMessageStreamResponse({ stream });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";

  // Only composite ids map to an agent session; a plain UUID chat never
  // reached the agent, so there is nothing to delete server-side.
  const composite = splitChatId(id);
  if (!composite) {
    return Response.json({ deleted: false });
  }

  try {
    const client = getAcpClient(composite.agentId);
    const deleted = await client.deleteSession(composite.sessionId);
    return Response.json({ deleted });
  } catch (error) {
    return new ChatbotError(
      "bad_request:api",
      error instanceof Error ? error.message : String(error)
    ).toResponse();
  }
}
