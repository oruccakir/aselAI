import { toast } from "@/components/chat/toast";
import { splitChatId } from "@/lib/acp/chat-id";
import {
  chatMessagesToMarkdown,
  type ExportLabels,
  firstUserText,
} from "@/lib/chat-export";
import type { ChatMessage } from "@/lib/types";
import { fetchWithErrorHandlers } from "@/lib/utils";

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 48) || "chat"
  );
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}`;
}

function filenameFor(
  agentId: string,
  messages: ChatMessage[],
  sessionId: string
): string {
  const title = firstUserText(messages) ?? sessionId.slice(0, 12);
  return `aselAI-${agentId}-${slugify(title)}-${timestamp()}.md`;
}

/** Trigger a client-side download of `markdown` as a .md file. */
export function downloadMarkdownFile(filename: string, markdown: string): void {
  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Serialize already-loaded messages and download them (used by the header). */
export function exportChatMessages(
  messages: ChatMessage[],
  opts: { agentId: string; sessionId: string; labels: ExportLabels }
): void {
  if (messages.length === 0) {
    return;
  }
  const markdown = chatMessagesToMarkdown(messages, opts);
  downloadMarkdownFile(
    filenameFor(opts.agentId, messages, opts.sessionId),
    markdown
  );
}

/**
 * Fetch a session's messages by composite chat id and download the report —
 * used by the sidebar so a chat can be exported without opening it. `chatId`
 * must be a composite `<agentId>:<sessionId>`; bare UUIDs have no session.
 */
export async function exportChatById(
  chatId: string,
  labels: ExportLabels
): Promise<void> {
  const split = splitChatId(chatId);
  if (!split) {
    toast({ description: labels.exportError, type: "error" });
    return;
  }

  let data: { messages?: ChatMessage[] };
  try {
    const res = await fetchWithErrorHandlers(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/messages?chatId=${encodeURIComponent(chatId)}`
    );
    data = (await res.json()) as { messages?: ChatMessage[] };
  } catch {
    toast({ description: labels.exportError, type: "error" });
    return;
  }

  const messages = data.messages ?? [];
  if (messages.length === 0) {
    toast({ description: labels.exportError, type: "error" });
    return;
  }

  exportChatMessages(messages, {
    agentId: split.agentId,
    labels,
    sessionId: split.sessionId,
  });
}
