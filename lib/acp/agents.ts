import {
  BotIcon,
  GemIcon,
  type LucideIcon,
  SquareTerminalIcon,
} from "lucide-react";

/**
 * Registry of ACP agent profiles — the multi-framework seam.
 *
 * Adding an entry here is the ONLY change needed to surface another agent
 * in the picker with its own icon, ACP client, session list, and history.
 * The `backend` field says how to spawn the agent process:
 *
 *  - `{ kind: "hermes", profileName, envHomeKey }` — the Hermes adapter
 *    from HERMES_ACP_HOME; a non-null `profileName` injects HERMES_HOME +
 *    HERMES_PROFILE so one checkout serves several isolated profiles.
 *  - `{ kind: "command", command, args }` — ANY ACP-speaking CLI (Gemini
 *    CLI, OpenCode, ...), spawned as-is with the user's home as cwd.
 *
 * `icon` is any lucide-react icon; the agent picker renders it for the
 * agent's entry. `greetingTagline` is the line under the greeting question
 * and `suggestions` are that agent's starter prompts — both are per-locale
 * records keyed by the UI language (see lib/i18n/dictionaries.ts).
 * Nothing outside this file may hardcode a specific agent id.
 *
 * Optional ACP capabilities degrade gracefully: an agent without
 * `session/list` simply shows an empty history (see lib/acp/client.ts).
 */
export type AcpAgentBackend =
  | {
      kind: "hermes";
      profileName: string | null;
      envHomeKey: string | null;
    }
  | { kind: "command"; command: string; args: readonly string[] };

export const ACP_AGENTS = [
  {
    backend: { envHomeKey: null, kind: "hermes", profileName: null },
    description: "Default Hermes agent",
    greetingTagline: {
      en: "Ask a question, explore ideas to secure the beyond, the future and our country.",
      tr: "Bir soru sor; ufkun ötesini, geleceği ve ülkemizi güvence altına alacak fikirleri keşfet.",
    },
    icon: BotIcon as LucideIcon,
    id: "default",
    label: "Aselsan Agent",
    suggestions: {
      en: [
        "What are ASELSAN's main product families and business sectors?",
        "Research the latest news about ASELSAN's Steel Dome air defense system",
        "Explain recent trends in radar and electronic warfare technology",
        "Draft a professional email summarizing a project status update",
      ],
      tr: [
        "ASELSAN'ın ana ürün aileleri ve iş sektörleri nelerdir?",
        "ASELSAN'ın Çelik Kubbe hava savunma sistemiyle ilgili son haberleri araştır",
        "Radar ve elektronik harp teknolojisindeki son eğilimleri açıkla",
        "Proje durum güncellemesini özetleyen profesyonel bir e-posta taslağı yaz",
      ],
    },
  },
  {
    backend: { args: ["acp"], command: "opencode", kind: "command" },
    description: "OpenCode coding agent over ACP",
    greetingTagline: {
      en: "An open-source coding agent — plan, write and refactor code together.",
      tr: "Açık kaynak bir kodlama ajanı — birlikte planla, kod yaz, refactor et.",
    },
    icon: SquareTerminalIcon as LucideIcon,
    id: "opencode",
    label: "OpenCode",
    suggestions: {
      en: [
        "Write a shell script that backs up my dotfiles",
        "Explain what a JSON-RPC 2.0 message looks like",
        "Refactor a React component from classes to hooks",
        "Review a Python function for performance issues",
      ],
      tr: [
        "Dotfile'larımı yedekleyen bir shell script yaz",
        "Bir JSON-RPC 2.0 mesajının nasıl göründüğünü açıkla",
        "Bir React bileşenini class'tan hook'lara refactor et",
        "Bir Python fonksiyonunu performans açısından incele",
      ],
    },
  },
  {
    backend: { args: ["--acp"], command: "gemini", kind: "command" },
    description: "Google Gemini CLI over ACP",
    greetingTagline: {
      en: "Google's Gemini agent — ask questions, explore ideas, get answers fast.",
      tr: "Google'ın Gemini ajanı — soru sor, fikir keşfet, hızlıca yanıt al.",
    },
    icon: GemIcon as LucideIcon,
    id: "gemini",
    label: "Gemini CLI",
    suggestions: {
      en: [
        "Summarize the key ideas behind the Agent Client Protocol",
        "Explain the trade-offs between REST and gRPC",
        "Write a Python script that renames files in bulk",
        "Brainstorm names for an internal developer tool",
      ],
      tr: [
        "Agent Client Protocol'ün temel fikirlerini özetle",
        "REST ile gRPC arasındaki ödünleşimleri açıkla",
        "Dosyaları toplu yeniden adlandıran bir Python scripti yaz",
        "Şirket içi bir geliştirici aracı için isim önerileri üret",
      ],
    },
  },
] as const;

export type AcpAgentDefinition = (typeof ACP_AGENTS)[number];
export type AcpAgentId = (typeof ACP_AGENTS)[number]["id"];

export const DEFAULT_AGENT_ID: AcpAgentId = ACP_AGENTS[0].id;

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
