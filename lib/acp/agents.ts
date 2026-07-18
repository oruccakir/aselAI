import { BotIcon, type LucideIcon } from "lucide-react";

/**
 * Registry of ACP agent profiles — the multi-profile seam.
 *
 * Adding an entry here is the ONLY change needed to surface a second agent
 * in the picker with its own icon, ACP client, session list, and history:
 *
 *   { id: "asel", label: "Asel Agent", description: "...", icon: RadarIcon,
 *     profileName: "asel-agent", envHomeKey: "ASEL_HERMES_HOME",
 *     greetingTagline: "...", suggestions: ["...", "..."] },
 *
 * `icon` is any lucide-react icon; the model picker renders it for the
 * agent's entry. `profileName: null` means the default Hermes home with no
 * profile env. `greetingTagline` is the line under the greeting question
 * and `suggestions` are that agent's starter prompts — both are per-locale
 * records keyed by the UI language (see lib/i18n/dictionaries.ts).
 * Nothing outside this file may hardcode a specific agent id.
 */
export const ACP_AGENTS = [
  {
    description: "Default Hermes agent",
    envHomeKey: null,
    greetingTagline: {
      en: "Ask a question, explore ideas to secure the beyond, the future and our country.",
      tr: "Bir soru sor; ufkun ötesini, geleceği ve ülkemizi güvence altına alacak fikirleri keşfet.",
    },
    icon: BotIcon as LucideIcon,
    id: "default",
    label: "Aselsan Agent",
    profileName: null,
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
  // Re-enable when the research profile goes live (also re-import
  // TelescopeIcon from lucide-react):
  // {
  //   description: "Deep research and analysis agent",
  //   envHomeKey: "RESEARCH_HERMES_HOME",
  //   greetingTagline: {
  //     en: "Dig deep into any topic with sourced analysis.",
  //     tr: "Her konuyu kaynaklı analizle derinlemesine incele.",
  //   },
  //   icon: TelescopeIcon as LucideIcon,
  //   id: "research",
  //   label: "Research Agent",
  //   profileName: "research-agent",
  //   suggestions: {
  //     en: ["Survey the state of the art in GaN radar amplifiers"],
  //     tr: ["GaN radar yükselteçlerinde son teknolojiyi araştır"],
  //   },
  // },
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
