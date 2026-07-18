import type { LucideIcon } from "lucide-react";
import { ACP_AGENTS } from "./acp/agents";

export type AgentCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatAgent = {
  id: string;
  name: string;
  description: string;
  icon?: LucideIcon;
};

// The composer's picker is the ACP agent picker: one entry per registry agent.
export const chatAgents: ChatAgent[] = ACP_AGENTS.map((agent) => ({
  description: agent.description,
  icon: agent.icon,
  id: agent.id,
  name: agent.label,
}));

// Tools must be true or the approval/tool UI is gated off at the picker
// level. Vision stays false until attachments go through the agent.
export const agentCapabilities: Record<string, AgentCapabilities> =
  Object.fromEntries(
    ACP_AGENTS.map((agent) => [
      agent.id,
      { reasoning: true, tools: true, vision: false },
    ])
  );
