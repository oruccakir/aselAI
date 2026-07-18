import type { UIMessageChunk } from "ai";
import type { AcpAgentDefinition } from "./agents";
import type { AcpUpdate } from "./client";

/**
 * Maps ACP `session/update` payloads to AI SDK UIMessageChunks (replaces
 * the reference's eventMap + NDJSON→SSE transcoder pair).
 *
 * Deliberately capability-agnostic: tool name, title and input come from
 * the payload, so any new Hermes skill, MCP server or sub-agent surfaces
 * here with no code change. Only a brand-new `sessionUpdate` kind should
 * ever need a new branch.
 *
 * All correlation state is per mapper instance (per stream) — the
 * reference's module-global toolTitleMap leaked across concurrent
 * sessions; do not reintroduce that.
 */

export const TERMINAL_TOOL_STATUSES = new Set([
  "completed",
  "failed",
  "error",
  "canceled",
  "cancelled",
]);

/** Extract plain text from an ACP content block (string, {text}, {type:"text",text}, or nested {content}). */
export function textOfContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (content && typeof content === "object") {
    const block = content as Record<string, unknown>;
    if (typeof block.text === "string") {
      return block.text;
    }
    if ("content" in block) {
      return textOfContent(block.content);
    }
  }
  return "";
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export type AcpUiStreamMapper = {
  map: (update: AcpUpdate) => UIMessageChunk[];
  flush: () => UIMessageChunk[];
};

export function createAcpUiStreamMapper(
  agent: AcpAgentDefinition
): AcpUiStreamMapper {
  let partSeq = 0;
  let openTextId: string | null = null;
  let openReasoningId: string | null = null;
  const knownToolCalls = new Set<string>();

  const closeBlocks = (): UIMessageChunk[] => {
    const chunks: UIMessageChunk[] = [];
    if (openTextId) {
      chunks.push({ id: openTextId, type: "text-end" });
      openTextId = null;
    }
    if (openReasoningId) {
      chunks.push({ id: openReasoningId, type: "reasoning-end" });
      openReasoningId = null;
    }
    return chunks;
  };

  const announceToolCall = (
    toolCallId: string,
    title: string,
    rawInput: unknown
  ): UIMessageChunk[] => {
    knownToolCalls.add(toolCallId);
    return [
      ...closeBlocks(),
      { dynamic: true, toolCallId, toolName: title, type: "tool-input-start" },
      {
        dynamic: true,
        input: rawInput ?? {},
        toolCallId,
        toolName: title,
        type: "tool-input-available",
      },
    ];
  };

  const map = (update: AcpUpdate): UIMessageChunk[] => {
    switch (update.sessionUpdate) {
      case "agent_message_chunk": {
        const text = textOfContent(update.content);
        if (!text) {
          return [];
        }
        const chunks: UIMessageChunk[] = [];
        if (openReasoningId) {
          chunks.push({ id: openReasoningId, type: "reasoning-end" });
          openReasoningId = null;
        }
        if (!openTextId) {
          partSeq += 1;
          openTextId = `acp-text-${partSeq}`;
          chunks.push({ id: openTextId, type: "text-start" });
        }
        chunks.push({ delta: text, id: openTextId, type: "text-delta" });
        return chunks;
      }

      case "agent_thought_chunk": {
        const text = textOfContent(update.content);
        if (!text) {
          return [];
        }
        const chunks: UIMessageChunk[] = [];
        if (openTextId) {
          chunks.push({ id: openTextId, type: "text-end" });
          openTextId = null;
        }
        if (!openReasoningId) {
          partSeq += 1;
          openReasoningId = `acp-reasoning-${partSeq}`;
          chunks.push({ id: openReasoningId, type: "reasoning-start" });
        }
        chunks.push({
          delta: text,
          id: openReasoningId,
          type: "reasoning-delta",
        });
        return chunks;
      }

      case "tool_call": {
        partSeq += 1;
        const toolCallId = asString(update.toolCallId) ?? `acp-tool-${partSeq}`;
        const title = asString(update.title) ?? toolCallId;
        return announceToolCall(toolCallId, title, update.rawInput);
      }

      case "tool_call_update": {
        const status = asString(update.status);
        if (!(status && TERMINAL_TOOL_STATUSES.has(status))) {
          return [];
        }
        const toolCallId = asString(update.toolCallId);
        if (!toolCallId) {
          return [];
        }
        knownToolCalls.delete(toolCallId);
        const content = textOfContent(update.content);
        if (status === "completed") {
          return [
            {
              dynamic: true,
              // No status fallback: the header badge already says
              // "Completed", so an output that just repeats it is noise.
              output: content,
              toolCallId,
              type: "tool-output-available",
            },
          ];
        }
        return [
          {
            dynamic: true,
            errorText: content || status,
            toolCallId,
            type: "tool-output-error",
          },
        ];
      }

      case "x-permission-request": {
        const requestId = asString(update.requestId);
        if (!requestId) {
          return [];
        }
        const toolCall = (update.toolCall ?? {}) as Record<string, unknown>;
        const toolCallId =
          asString(toolCall.toolCallId) ?? `acp-approval-${requestId}`;
        const chunks: UIMessageChunk[] = [];
        // An approval chunk attaches to an existing tool part by toolCallId;
        // synthesize the part if the agent never announced this tool_call.
        if (!knownToolCalls.has(toolCallId)) {
          chunks.push(
            ...announceToolCall(
              toolCallId,
              asString(toolCall.title) ?? "tool",
              toolCall.rawInput
            )
          );
        }
        chunks.push({
          approvalId: requestId,
          toolCallId,
          type: "tool-approval-request",
        });
        return chunks;
      }

      case "plan": {
        const entries = Array.isArray(update.entries) ? update.entries : [];
        const summary = entries
          .map((entry) => {
            const e = (entry ?? {}) as Record<string, unknown>;
            const status = asString(e.status);
            const content = textOfContent(e.content) || asString(e.content);
            return [status, content].filter(Boolean).join(": ");
          })
          .filter(Boolean)
          .join(" | ");
        if (!summary) {
          return [];
        }
        return [
          {
            data: {
              message: summary,
              modelId: agent.id,
              modelName: agent.label,
              phase: "thinking",
            },
            transient: true,
            type: "data-waiting-status",
          } as UIMessageChunk,
        ];
      }

      default:
        // usage_update, user_message_chunk, unknown kinds — ignored.
        return [];
    }
  };

  return { flush: closeBlocks, map };
}
