"use client";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "../ai-elements/reasoning";

type MessageReasoningProps = {
  isLoading: boolean;
  reasoning: string;
};

export function MessageReasoning({
  isLoading,
  reasoning,
}: MessageReasoningProps) {
  // Collapsed by default — the operator opens the reasoning trace on demand.
  // defaultOpen={false} opts out of the Reasoning component's auto-open AND
  // auto-close (see the isExplicitlyClosed guard in ai-elements/reasoning),
  // so the box stays where the user puts it.
  return (
    <Reasoning
      data-testid="message-reasoning"
      defaultOpen={false}
      isStreaming={isLoading}
    >
      <ReasoningTrigger />
      <ReasoningContent>{reasoning}</ReasoningContent>
    </Reasoning>
  );
}
