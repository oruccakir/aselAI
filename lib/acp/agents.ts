import { BotIcon, type LucideIcon } from "lucide-react";

/**
 * Registry of ACP agent profiles — the multi-profile seam.
 *
 * Adding an entry here is the ONLY change needed to surface a second agent
 * in the picker with its own icon, ACP client, session list, and history:
 *
 *   { id: "asel", label: "Asel Agent", description: "...", icon: RadarIcon,
 *     profileName: "asel-agent", envHomeKey: "ASEL_HERMES_HOME" },
 *
 * `icon` is any lucide-react icon; the model picker renders it for the
 * agent's entry. `profileName: null` means the default Hermes home with no
 * profile env. Nothing outside this file may hardcode a specific agent id.
 */
export const ACP_AGENTS = [
  {
    description: "Default Hermes agent",
    envHomeKey: null,
    icon: BotIcon as LucideIcon,
    id: "default",
    label: "Aselsan Agent",
    profileName: null,
  },
  // Re-enable when the research profile goes live (also re-import
  // TelescopeIcon from lucide-react):
  // {
  //   description: "Deep research and analysis agent",
  //   envHomeKey: "RESEARCH_HERMES_HOME",
  //   icon: TelescopeIcon as LucideIcon,
  //   id: "research",
  //   label: "Research Agent",
  //   profileName: "research-agent",
  // },
] as const;

export type AcpAgentDefinition = (typeof ACP_AGENTS)[number];
export type AcpAgentId = (typeof ACP_AGENTS)[number]["id"];

export function isAcpAgentId(value: string): value is AcpAgentId {
  return ACP_AGENTS.some((agent) => agent.id === value);
}

export function getAcpAgent(id: string): AcpAgentDefinition {
  const agent = ACP_AGENTS.find((candidate) => candidate.id === id);
  if (!agent) {
    throw new Error(`Unknown ACP agent id: ${id}`);
  }
  return agent;
}
