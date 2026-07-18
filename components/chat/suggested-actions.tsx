"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { ArrowUpRightIcon } from "lucide-react";
import { memo, useCallback } from "react";
import { ACP_AGENTS, getAcpAgent, isAcpAgentId } from "@/lib/acp/agents";
import type { ChatMessage } from "@/lib/types";
import { Suggestion } from "../ai-elements/suggestion";
import type { VisibilityType } from "./visibility-selector";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedAgentId: string;
  selectedVisibilityType: VisibilityType;
};

function PureSuggestedActions({
  chatId,
  sendMessage,
  selectedAgentId,
}: SuggestedActionsProps) {
  const agent = isAcpAgentId(selectedAgentId)
    ? getAcpAgent(selectedAgentId)
    : ACP_AGENTS[0];
  const suggestedActions = agent.suggestions;
  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      window.history.pushState(
        {},
        "",
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
      );
      sendMessage({
        parts: [{ text: suggestion, type: "text" }],
        role: "user",
      });
    },
    [chatId, sendMessage]
  );

  return (
    <div
      className="flex w-full gap-2.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible"
      data-testid="suggested-actions"
      style={{
        msOverflowStyle: "none",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="min-w-[200px] shrink-0 sm:min-w-0 sm:shrink"
          exit={{ opacity: 0, y: 16 }}
          initial={{ opacity: 0, y: 16 }}
          key={suggestedAction}
          transition={{
            delay: 0.06 * index,
            duration: 0.4,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <Suggestion
            className="group h-auto w-full items-start justify-between gap-3 whitespace-nowrap rounded-xl border border-border/60 bg-card px-4 py-3 text-left text-[12px] text-foreground/70 leading-relaxed shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground hover:shadow-[var(--shadow-float)] sm:whitespace-normal sm:p-4 sm:text-[14px]"
            onClick={handleSuggestionClick}
            suggestion={suggestedAction}
          >
            <span className="min-w-0">{suggestedAction}</span>
            <ArrowUpRightIcon className="mt-0.5 size-3.5 shrink-0 text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          </Suggestion>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.selectedAgentId !== nextProps.selectedAgentId) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }

    return true;
  }
);
