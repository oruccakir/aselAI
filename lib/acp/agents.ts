/**
 * Registry of ACP agent profiles — the multi-profile seam.
 *
 * Adding an entry here is the ONLY change needed to surface a second agent
 * in the picker with its own ACP client, session list, and history, e.g.:
 *
 *   { id: "asel", label: "Asel Agent", description: "...",
 *     profileName: "asel-agent", envHomeKey: "ASEL_HERMES_HOME" },
 *
 * `profileName: null` means the default Hermes home with no profile env.
 * Nothing outside this file may hardcode a specific agent id.
 */
export const ACP_AGENTS = [
  {
    description: "Default Hermes agent",
    envHomeKey: null,
    id: "default",
    label: "Hermes",
    profileName: null,
  },
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
