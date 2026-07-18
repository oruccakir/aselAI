"use client";

import { BotIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveChat } from "@/hooks/use-active-chat";
import { DEFAULT_AGENT_ID } from "@/lib/acp/agents";
import { type ChatAgent, chatAgents } from "@/lib/agent-picker";
import { cn } from "@/lib/utils";
import { CheckCircleFillIcon, ChevronDownIcon } from "./icons";

function setCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 365;
  // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}`;
}

function AgentSelectorItem({
  agent,
  isSelected,
  setOpen,
  onSelect,
}: {
  agent: ChatAgent;
  isSelected: boolean;
  setOpen: (open: boolean) => void;
  onSelect: (agentId: string) => void;
}) {
  const AgentIcon = agent.icon ?? BotIcon;

  const handleSelect = useCallback(() => {
    onSelect(agent.id);
    setOpen(false);
  }, [agent.id, onSelect, setOpen]);

  return (
    <DropdownMenuItem
      className="group/item flex flex-row items-center justify-between gap-4"
      data-active={isSelected}
      onSelect={handleSelect}
    >
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <AgentIcon className="size-4" />
          {agent.name}
        </div>
        <div className="text-muted-foreground text-xs">{agent.description}</div>
      </div>
      <div className="text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
        <CheckCircleFillIcon />
      </div>
    </DropdownMenuItem>
  );
}

/**
 * Header agent selector — the primary multi-framework switcher, styled like
 * the LanguageSelector. Shares the active-chat context and the `chat-agent`
 * cookie with the composer's compact picker so the two never disagree. A
 * chat belongs to one agent / one ACP session, so switching here starts a
 * fresh chat (navigates to "/"); the sidebar history then follows the
 * newly selected agent via its per-agent pagination key.
 */
export function AgentSelector({
  className,
}: React.ComponentProps<typeof Button>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { currentAgentId, setCurrentAgentId } = useActiveChat();

  const selectedAgent =
    chatAgents.find((agent) => agent.id === currentAgentId) ??
    chatAgents.find((agent) => agent.id === DEFAULT_AGENT_ID) ??
    chatAgents[0];
  const SelectedIcon = selectedAgent.icon ?? BotIcon;

  const handleSelect = useCallback(
    (agentId: string) => {
      if (agentId === currentAgentId) {
        return;
      }
      setCurrentAgentId(agentId);
      setCookie("chat-agent", agentId);
      // A chat belongs to one agent — switching starts a new chat so the
      // next prompt opens a session on the newly selected backend.
      router.push("/");
    },
    [currentAgentId, router, setCurrentAgentId]
  );

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
          className
        )}
      >
        <Button
          className="gap-1.5 rounded-lg border-border/50 text-muted-foreground shadow-none transition-colors hover:text-foreground focus-visible:ring-0 focus-visible:border-border/50 active:translate-y-0"
          data-testid="agent-selector-header"
          size="sm"
          variant="outline"
        >
          <SelectedIcon className="size-4" />
          <span className="max-w-[120px] truncate">{selectedAgent.name}</span>
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[240px]">
        {chatAgents.map((agent) => (
          <AgentSelectorItem
            agent={agent}
            isSelected={agent.id === currentAgentId}
            key={agent.id}
            onSelect={handleSelect}
            setOpen={setOpen}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
