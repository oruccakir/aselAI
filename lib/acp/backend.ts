import { homedir } from "node:os";
import { join } from "node:path";
import {
  type AcpAgentBackend,
  type AcpAgentDefinition,
  type AcpAgentId,
  getAcpAgent,
} from "./agents";
import { AcpAgentClient, type AcpSpawnSpec } from "./client";

/**
 * Spawn specs for ACP agent backends. Each registry entry's `backend`
 * field (lib/acp/agents.ts) describes how to start its agent process;
 * this module turns that description into a concrete AcpSpawnSpec.
 *
 * Hermes env vars:
 *  - HERMES_ACP_HOME    Hermes checkout (default ~/.hermes/hermes-agent)
 *  - HERMES_ACP_PYTHON  venv python (default <home>/venv/bin/python)
 *  - <PROFILE>_HERMES_HOME  per-profile home override (backend.envHomeKey),
 *    default ~/.hermes/profiles/<profileName>
 *
 * Command backends (OpenCode, Antigravity via `agy-acp`, ...) are spawned
 * from the user's home directory with the inherited environment, so PATH
 * lookups and the agent's own auth/config resolution behave like a terminal
 * run.
 */
function hermesSpec(
  agent: AcpAgentDefinition,
  backend: Extract<AcpAgentBackend, { kind: "hermes" }>
): AcpSpawnSpec {
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

  if (backend.profileName) {
    const profileHome =
      (backend.envHomeKey ? process.env[backend.envHomeKey] : undefined) ??
      join(homedir(), ".hermes", "profiles", backend.profileName);
    spec.env = {
      ...process.env,
      HERMES_HOME: profileHome,
      HERMES_PROFILE: backend.profileName,
    };
  }

  return spec;
}

function commandSpec(
  agent: AcpAgentDefinition,
  backend: Extract<AcpAgentBackend, { kind: "command" }>
): AcpSpawnSpec {
  return {
    args: [...backend.args],
    command: backend.command,
    cwd: homedir(),
    label: `${agent.id}-acp`,
  };
}

function spawnSpec(agent: AcpAgentDefinition): AcpSpawnSpec {
  const backend: AcpAgentBackend = agent.backend;
  return backend.kind === "hermes"
    ? hermesSpec(agent, backend)
    : commandSpec(agent, backend);
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
    client = new AcpAgentClient(spawnSpec(getAcpAgent(agentId)));
    registry.set(agentId, client);
  }
  return client;
}
