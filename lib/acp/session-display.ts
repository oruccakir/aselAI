import type { DynamicToolUIPart } from "ai";
import type { ChatMessage } from "@/lib/types";
import type { AcpSessionInfo, AcpUpdate } from "./client";
import { TERMINAL_TOOL_STATUSES, textOfContent } from "./ui-stream";

export type AcpSessionSummary = {
  id: string;
  title: string;
  updatedAt: string | null;
};

export function normalizeSessionSummary(
  session: AcpSessionInfo
): AcpSessionSummary {
  const title = session.title?.trim() || session.sessionId.slice(0, 8);
  return {
    id: session.sessionId,
    title,
    updatedAt: session.updatedAt ?? null,
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

/**
 * Convert the `session/update` replay from `session/load` into parts-based
 * ChatMessages (the reference's acpUpdatesToChatMessages emitted a flat
 * { role, content } shape instead). Consecutive same-role chunks coalesce
 * into one message; message/thought chunks are deltas and concatenate
 * directly. Tool calls become dynamic-tool parts correlated by toolCallId.
 */
export function acpUpdatesToUIMessages(updates: AcpUpdate[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const baseTime = Date.now() - updates.length;
  let seq = 0;

  const toolPartByCallId = new Map<
    string,
    { part: DynamicToolUIPart; message: ChatMessage }
  >();

  const lastMessageOf = (role: "user" | "assistant"): ChatMessage => {
    const last = messages.at(-1);
    if (last?.role === role) {
      return last;
    }
    seq += 1;
    const message: ChatMessage = {
      id: `session-${role}-${seq}`,
      metadata: { createdAt: new Date(baseTime + seq).toISOString() },
      parts: [],
      role,
    };
    messages.push(message);
    return message;
  };

  const appendText = (
    role: "user" | "assistant",
    partType: "text" | "reasoning",
    delta: string
  ): void => {
    if (!delta) {
      return;
    }
    const message = lastMessageOf(role);
    const lastPart = message.parts.at(-1);
    if (lastPart?.type === partType) {
      lastPart.text += delta;
      return;
    }
    if (partType === "reasoning") {
      message.parts.push({ state: "done", text: delta, type: "reasoning" });
    } else {
      message.parts.push({ text: delta, type: "text" });
    }
  };

  for (const update of updates) {
    switch (update.sessionUpdate) {
      case "user_message_chunk": {
        appendText("user", "text", textOfContent(update.content));
        break;
      }
      case "agent_message_chunk": {
        appendText("assistant", "text", textOfContent(update.content));
        break;
      }
      case "agent_thought_chunk": {
        appendText("assistant", "reasoning", textOfContent(update.content));
        break;
      }
      case "tool_call": {
        const toolCallId = asString(update.toolCallId);
        if (!toolCallId) {
          break;
        }
        const part: DynamicToolUIPart = {
          input: update.rawInput ?? {},
          state: "input-available",
          toolCallId,
          toolName: asString(update.title) ?? toolCallId,
          type: "dynamic-tool",
        };
        const owner = lastMessageOf("assistant");
        owner.parts.push(part);
        toolPartByCallId.set(toolCallId, { message: owner, part });
        break;
      }
      case "tool_call_update": {
        const toolCallId = asString(update.toolCallId);
        const status = asString(update.status);
        if (!(toolCallId && status && TERMINAL_TOOL_STATUSES.has(status))) {
          break;
        }
        const entry = toolPartByCallId.get(toolCallId);
        if (!entry) {
          break;
        }
        toolPartByCallId.delete(toolCallId);
        const { part, message } = entry;
        const content = textOfContent(update.content);
        const index = message.parts.indexOf(part);
        const settled: DynamicToolUIPart =
          status === "completed"
            ? {
                input: part.input,
                output: content,
                state: "output-available",
                toolCallId,
                toolName: part.toolName,
                type: "dynamic-tool",
              }
            : {
                errorText: content || status,
                input: part.input,
                state: "output-error",
                toolCallId,
                toolName: part.toolName,
                type: "dynamic-tool",
              };
        if (index === -1) {
          message.parts.push(settled);
        } else {
          message.parts[index] = settled;
        }
        break;
      }
      default:
        break;
    }
  }

  return messages;
}
