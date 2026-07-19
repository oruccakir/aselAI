"use client";

import { DownloadIcon } from "lucide-react";
import { useCallback } from "react";
import { exportChatMessages } from "@/components/chat/export-chat";
import { Button } from "@/components/ui/button";
import { useActiveChat } from "@/hooks/use-active-chat";
import { splitChatId } from "@/lib/acp/chat-id";
import { useLocale } from "@/lib/i18n/locale-context";

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
    exportChatMessages(messages, {
      agentId: currentAgentId,
      labels,
      sessionId: sessionIdFromUrl(chatId),
    });
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
