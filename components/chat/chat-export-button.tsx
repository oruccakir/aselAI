"use client";

import { DownloadIcon } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useActiveChat } from "@/hooks/use-active-chat";
import { splitChatId } from "@/lib/acp/chat-id";
import { chatMessagesToMarkdown } from "@/lib/chat-export";
import { useLocale } from "@/lib/i18n/locale-context";

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

/** Resolve the real ACP session id at click time from the rewritten URL. */
function sessionIdFromUrl(fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }
  const match = window.location.pathname.match(/\/chat\/([^/]+)/);
  if (!match) {
    return fallback;
  }
  const split = splitChatId(decodeURIComponent(match[1]));
  return split ? split.sessionId : fallback;
}

export function ChatExportButton() {
  const { messages, chatId, currentAgentId } = useActiveChat();
  const { dict } = useLocale();
  const labels = dict.export;

  const handleDownload = useCallback(() => {
    if (messages.length === 0) {
      return;
    }
    const sessionId = sessionIdFromUrl(chatId);
    const markdown = chatMessagesToMarkdown(messages, {
      agentId: currentAgentId,
      labels,
      sessionId,
    });

    // Title for the filename = first user text (slugified), else session id.
    const firstUser = messages.find((message) => message.role === "user");
    const firstText = firstUser?.parts?.find(
      (part) => part.type === "text"
    )?.text;
    const namePart = slugify(firstText ?? sessionId.slice(0, 12));
    const filename = `aselAI-${currentAgentId}-${namePart}-${timestamp()}.md`;

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [messages, chatId, currentAgentId, labels]);

  return (
    <Button
      className="gap-1.5 rounded-lg border-border/50 text-muted-foreground shadow-none transition-colors hover:text-foreground focus-visible:ring-0 focus-visible:border-border/50 active:translate-y-0"
      data-testid="chat-export-button"
      disabled={messages.length === 0}
      onClick={handleDownload}
      size="sm"
      title={labels.button}
      type="button"
      variant="outline"
    >
      <DownloadIcon className="size-4" />
      <span className="md:sr-only">{labels.button}</span>
    </Button>
  );
}
