import type { UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { WeatherAtLocation } from "@/components/chat/weather";

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

// Plain replacements for the former Drizzle-inferred types (lib/db/schema.ts).
// TODO(ACP): these shapes should eventually come from the agent protocol.
export type AppUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

export type Chat = {
  id: string;
  createdAt: Date;
  title: string;
  userId: string;
  visibility: "public" | "private";
};

export type DBMessage = {
  id: string;
  chatId: string;
  role: string;
  parts: unknown;
  attachments: unknown;
  createdAt: Date;
};

export type Document = {
  id: string;
  createdAt: Date;
  title: string;
  content: string | null;
  kind: ArtifactKind;
  userId: string;
};

export type Suggestion = {
  id: string;
  documentId: string;
  documentCreatedAt: Date;
  originalText: string;
  suggestedText: string;
  description: string | null;
  isResolved: boolean;
  userId: string;
  createdAt: Date;
};

// Inlined from the former lib/ai/tools/* definitions (InferUITool shapes).
export type ChatTools = {
  getWeather: {
    input: { city?: string; latitude?: number; longitude?: number };
    output: WeatherAtLocation;
  };
  createDocument: {
    input: { title: string; kind: ArtifactKind };
    output:
      | { id: string; title: string; kind: ArtifactKind; content: string }
      | { error: string };
  };
  updateDocument: {
    input: { id: string; description: string };
    output:
      | { id: string; title: string; kind: ArtifactKind; content: string }
      | { error: string };
  };
  requestSuggestions: {
    input: { documentId: string };
    output:
      | { id: string; title: string; kind: ArtifactKind; message: string }
      | { error: string };
  };
};

export type WaitingStatusData = {
  phase: "waiting" | "still-waiting" | "health" | "thinking";
  message: string;
  modelId: string;
  modelName: string;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  "chat-title": string;
  "session-id": string;
  "waiting-status": WaitingStatusData;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
