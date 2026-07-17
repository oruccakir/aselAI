import { type AcpAgentId, isAcpAgentId } from "./agents";

/**
 * A chat id is either a client-generated UUID (a chat with no session yet)
 * or the composite `<agentId>:<sessionId>`. UUIDs contain no colon, so
 * "no colon ⇒ new chat" is the discriminator.
 */
export function joinChatId(agentId: AcpAgentId, sessionId: string): string {
  return `${agentId}:${sessionId}`;
}

export function splitChatId(
  id: string
): { agentId: AcpAgentId; sessionId: string } | null {
  const colon = id.indexOf(":");
  if (colon === -1) {
    return null;
  }
  const agentId = id.slice(0, colon);
  const sessionId = id.slice(colon + 1);
  if (!(sessionId && isAcpAgentId(agentId))) {
    return null;
  }
  return { agentId, sessionId };
}
