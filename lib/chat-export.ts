import type { ChatMessage } from "@/lib/types";

/**
 * Strings used by {@link chatMessagesToMarkdown}. Mirrors `dict.export` in
 * `lib/i18n/dictionaries.ts` so the report follows the app locale (CLAUDE.md:
 * never inline user-facing strings).
 */
export type ExportLabels = {
  agent: string;
  assistant: string;
  attachment: string;
  button: string;
  exportError: string;
  exportedAt: string;
  messages: string;
  session: string;
  tool: string;
  toolApproved: string;
  toolDenied: string;
  toolError: string;
  toolPending: string;
  untitled: string;
  user: string;
};

// The AI SDK `UIMessage.parts` union is wide; we only read a handful of
// fields per branch, so narrow to a permissive shape inside each case rather
// than threading the whole union through the serializer.
type AnyPart = {
  type: string;
  // text / reasoning
  text?: string;
  // dynamic-tool / typed tool-*
  toolName?: string;
  title?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  state?: string;
  approval?: { id?: string; approved?: boolean } | null;
  // file
  filename?: string;
  mediaType?: string;
  url?: string;
};

function jsonStringify(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function fenced(lang: string, body: string): string {
  return `\`\`\`${lang}\n${body}\n\`\`\``;
}

/** Tool part → human-readable state flag (empty string for plain success). */
function toolStateLabel(part: AnyPart, labels: ExportLabels): string {
  if (part.approval?.approved === true) {
    return labels.toolApproved;
  }
  if (part.approval?.approved === false) {
    return labels.toolDenied;
  }
  if (part.state === "output-error") {
    return labels.toolError;
  }
  if (
    part.state === "output-available" ||
    part.state === "approval-responded"
  ) {
    // Output present and not explicitly denied ⇒ no flag (clean success).
    return "";
  }
  // input-available / approval-requested / streaming — still pending.
  return labels.toolPending;
}

function toolNameOf(part: AnyPart): string {
  if (part.title) {
    return part.title;
  }
  if (part.toolName) {
    return part.toolName;
  }
  // typed tool parts carry the name in `type` as `tool-<name>`.
  return part.type.startsWith("tool-") ? part.type.slice(5) : part.type;
}

function serializePart(part: AnyPart, labels: ExportLabels): string | null {
  switch (part.type) {
    case "text": {
      const text = part.text?.trim();
      return text ? text : null;
    }
    // Reasoning is intentionally excluded — the export is a clean
    // after-action report of user/assistant turns and tool I/O.
    case "reasoning":
      return null;
    case "file": {
      return `_${labels.attachment}: ${part.filename ?? "file"}_`;
    }
    default: {
      if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
        const flag = toolStateLabel(part, labels);
        const header = `**${labels.tool}: ${toolNameOf(part)}**${
          flag ? ` — ${flag}` : ""
        }`;
        const blocks: string[] = [header];
        const inputJson = jsonStringify(part.input);
        if (inputJson && inputJson !== "{}") {
          blocks.push(fenced("json", inputJson));
        }
        const outputJson =
          part.state === "output-error"
            ? jsonStringify(part.errorText ?? part.output)
            : jsonStringify(part.output);
        if (outputJson) {
          blocks.push(fenced("json", outputJson));
        }
        return blocks.join("\n\n");
      }
      return null;
    }
  }
}

export function firstUserText(
  messages: ChatMessage[],
  limit = 80
): string | null {
  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }
    for (const part of (message.parts ?? []) as AnyPart[]) {
      if (part.type === "text" && part.text) {
        const text = part.text.trim().replace(/\s+/g, " ");
        return text.length > limit ? `${text.slice(0, limit)}…` : text;
      }
    }
  }
  return null;
}

/**
 * Serialize a chat into a Markdown after-action report. Pure: no React, no
 * browser APIs — the caller triggers the download.
 */
export function chatMessagesToMarkdown(
  messages: ChatMessage[],
  opts: { agentId: string; sessionId: string; labels: ExportLabels }
): string {
  const { agentId, sessionId, labels } = opts;
  const exportedAt = new Date().toISOString();
  const title = firstUserText(messages) ?? labels.untitled;

  const lines: string[] = [
    `# ${title}`,
    "",
    `> ${labels.agent}: ${agentId}`,
    `> ${labels.session}: ${sessionId}`,
    `> ${labels.exportedAt}: ${exportedAt}`,
    `> ${labels.messages}: ${messages.length}`,
    "",
  ];

  for (const message of messages) {
    const roleLabel = message.role === "user" ? labels.user : labels.assistant;
    const body = (message.parts ?? [])
      .map((part) => serializePart(part as AnyPart, labels))
      .filter((block): block is string => block !== null);

    if (body.length === 0) {
      continue;
    }

    lines.push(`## ${roleLabel}`, "", ...body, "");
  }

  lines.push("---", `_aselAI • ${labels.exportedAt}: ${exportedAt}_`, "");

  return lines.join("\n");
}
