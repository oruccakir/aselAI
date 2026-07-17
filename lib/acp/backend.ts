import { homedir } from "node:os";
import { join } from "node:path";
import {
  type AcpAgentDefinition,
  type AcpAgentId,
  getAcpAgent,
} from "./agents";
import { AcpAgentClient, type AcpSpawnSpec } from "./client";

/**
 * Spawn specs for the Hermes ACP adapter (ported from cakir-ai's
 * backends.ts). A plain entry runs against the default Hermes home; a
 * profile entry additionally injects HERMES_HOME + HERMES_PROFILE so the
 * same checkout serves multiple isolated agent profiles.
 *
 * Env vars:
 *  - HERMES_ACP_HOME    Hermes checkout (default ~/.hermes/hermes-agent)
 *  - HERMES_ACP_PYTHON  venv python (default <home>/venv/bin/python)
 *  - <PROFILE>_HERMES_HOME  per-profile home override (agent.envHomeKey),
 *    default ~/.hermes/profiles/<profileName>
 */
function hermesSpec(agent: AcpAgentDefinition): AcpSpawnSpec {
  const home =
    process.env.HERMES_ACP_HOME ?? join(homedir(), ".hermes", "hermes-agent");
  const python =
    process.env.HERMES_ACP_PYTHON ?? join(home, "venv", "bin", "python");

  const spec: AcpSpawnSpec = {
    args: ["-m", "acp_adapter.entry"],
    command: python,
    cwd: home,
    label: `${agent.id}-acp`,
  };

  if (agent.profileName) {
    const profileHome =
      (agent.envHomeKey ? process.env[agent.envHomeKey] : undefined) ??
      join(homedir(), ".hermes", "profiles", agent.profileName);
    spec.env = {
      ...process.env,
      HERMES_HOME: profileHome,
      HERMES_PROFILE: agent.profileName,
    };
  }

  return spec;
}

/**
 * Lazy client singleton per agent id, stored on globalThis so Next.js dev
 * HMR module re-evaluation reuses the running child process instead of
 * leaking an orphan per reload. A child is only spawned when its agent is
 * first prompted.
 */
const CLIENT_REGISTRY_KEY = Symbol.for("aselAI.acpClients");

type ClientRegistry = Map<AcpAgentId, AcpAgentClient>;

function clientRegistry(): ClientRegistry {
  const globalStore = globalThis as Record<symbol, unknown>;
  if (!globalStore[CLIENT_REGISTRY_KEY]) {
    globalStore[CLIENT_REGISTRY_KEY] = new Map();
  }
  return globalStore[CLIENT_REGISTRY_KEY] as ClientRegistry;
}

export function getAcpClient(agentId: AcpAgentId): AcpAgentClient {
  const registry = clientRegistry();
  let client = registry.get(agentId);
  if (!client) {
    client = new AcpAgentClient(hermesSpec(getAcpAgent(agentId)));
    registry.set(agentId, client);
  }
  return client;
}
