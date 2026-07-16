"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatMessage } from "@/lib/types";

export function submitEditedMessage({
  message,
  text,
  setMessages,
  regenerate,
}: {
  message: ChatMessage;
  text: string;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
}) {
  // TODO(ACP): delete trailing messages server-side through the agent
  // backend (was: deleteTrailingMessages server action). The local
  // truncation below keeps the client state consistent.
  setMessages((messages) => {
    const index = messages.findIndex((m) => m.id === message.id);
    if (index === -1) {
      return messages;
    }

    return [
      ...messages.slice(0, index),
      { ...message, parts: [{ text, type: "text" as const }] },
    ];
  });

  regenerate();
}
