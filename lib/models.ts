import type { LucideIcon } from "lucide-react";
import { ACP_AGENTS } from "./acp/agents";

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  icon?: LucideIcon;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

// The "model" picker is the ACP agent picker: one entry per registry agent.
export const chatModels: ChatModel[] = ACP_AGENTS.map((agent) => ({
  description: agent.description,
  icon: agent.icon,
  id: agent.id,
  name: agent.label,
  provider: "acp",
}));

export const DEFAULT_CHAT_MODEL: string = ACP_AGENTS[0].id;

// Tools must be true or the approval/tool UI is gated off at the picker
// level. Vision stays false until attachments go through the agent.
export const modelCapabilities: Record<string, ModelCapabilities> =
  Object.fromEntries(
    ACP_AGENTS.map((agent) => [
      agent.id,
      { reasoning: true, tools: true, vision: false },
    ])
  );
