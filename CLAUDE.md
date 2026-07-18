# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This started as the Vercel **Chatbot** template (Next.js 16 App Router + AI SDK 7), customized as `aselAI`. The original backend (auth, DB, provider calls) was removed in [#1](https://github.com/oruccakir/aselAI/issues/1); [#3](https://github.com/oruccakir/aselAI/issues/3) connected the UI to an external **Hermes agent over ACP** (Agent Client Protocol). The agent is the "brain" — it owns its tools, skills, memory and conversation history. This app is a thin ACP client: **the agent's sessions ARE the chat history**.

## ACP architecture

```
Browser  useChat ──DefaultChatTransport──> POST /api/chat
                                               │
                                     lib/acp/client.ts  (spawned child proc, NDJSON JSON-RPC 2.0)
                                               │ session/update
                                     lib/acp/ui-stream.ts  (AcpUpdate → UIMessageChunk)
                                               │
                                     createUIMessageStream → SSE → useChat
```

- **`lib/acp/agents.ts`** — the `ACP_AGENTS` registry, the multi-profile seam. Adding an entry is the ONLY change needed to surface another agent (own picker entry, own client/child process, own session history). Nothing else may hardcode an agent id.
- **`lib/acp/client.ts`** — NDJSON JSON-RPC client (`initialize`, `session/new|list|load|prompt|cancel`; reverse request `session/request_permission`). Multi-session: `activePrompts` keyed by sessionId, per-session latest-wins cancel. The process-global `pendingPermissions` registry stores agent-supplied options; `resolveAcpPermissionByDecision(requestId, approved)` maps a boolean to a concrete optionId (55s auto-deny timeout).
- **`lib/acp/backend.ts`** — Hermes spawn specs (profile entries inject `HERMES_HOME`/`HERMES_PROFILE`); lazy client singletons per agent id on `globalThis` (HMR-safe).
- **`lib/acp/chat-id.ts`** — chat id codec: composite `<agentId>:<sessionId>`; no colon ⇒ new chat (client UUID).
- **`lib/acp/ui-stream.ts`** — per-stream mapper from ACP `sessionUpdate` kinds to UIMessageChunks (`agent_message_chunk`→text, `agent_thought_chunk`→reasoning, `tool_call(_update)`→dynamic tool parts, `x-permission-request`→`tool-approval-request`, `plan`→transient waiting-status). Capability-agnostic by design: new agent tools surface with no code change.
- **`lib/acp/session-display.ts`** — session summaries for the sidebar; `acpUpdatesToUIMessages` converts a `session/load` replay into parts-based `ChatMessage`s.
- **Routes** (all `runtime = "nodejs"`): `POST /api/chat` (prompt turn; emits transient `data-session-id` with the composite id on first send), `GET /api/history?agent=&cursor=` (session/list → `{ chats, hasMore, nextCursor }`), `GET /api/messages?chatId=` (session/load replay), `POST /api/acp/permission` (out-of-band approval answer).

### The chat id / session flow
New chat: client UUID → `POST /api/chat` → `session/new` → server streams `data-session-id` → `hooks/use-active-chat.tsx` stores it in `resolvedChatIdRef`, rewrites the URL via `history.replaceState`, and the transport sends `resolvedChatIdRef.current ?? id` on every subsequent send — this is what keeps a conversation on ONE session. The client-side `useChat` id deliberately stays the original UUID while the chat is live (`isLiveResolvedChat` guard) because `usePathname` tracks native `replaceState` in Next 16 and an id change would remount the chat mid-stream. Cold-opening `/chat/<agentId>:<sessionId>` fetches `/api/messages` (session/load).

### The permission flow (do NOT re-route through sendAutomaticallyWhen)
Hermes blocks its turn on `session/request_permission` while the original `/api/chat` SSE stream stays open. The Allow/Deny buttons (`ToolApprovalActions` in `components/chat/message.tsx`) update local part state via `addToolApprovalResponse` AND `POST /api/acp/permission`; tool output then arrives on the original stream. A `sendAutomaticallyWhen` continuation would open a second concurrent stream on the same chat — never do that.

### History
Per-agent, cursor-paged: `lib/chat-history.ts` exports the `getChatHistoryPaginationKey(agentId)` SWR-infinite key factory (`unstable_serialize` keys off the first-page string, so closures from different call sites share one cache entry). `ActiveChatProvider` wraps the sidebar (hoisted in `app/(chat)/layout.tsx`) so the history list follows the selected agent. The composer's picker is the agent picker — `lib/agent-picker.ts` derives `chatAgents`/`agentCapabilities` from the registry (`DEFAULT_AGENT_ID` lives in `lib/acp/agents.ts`); the UI passes the selection around as `selectedAgentId`/`currentAgentId`.

## Commands

Package manager is **pnpm** (`packageManager: pnpm@10.32.1`).

- `pnpm dev` — start dev server (Turbopack) on :3000. `ACP_DEBUG=1 pnpm dev` surfaces the agent's stderr (handshake, per-turn logs).
- `pnpm build` / `pnpm start` — production build/serve
- `pnpm check` / `pnpm fix` — lint/autofix via **ultracite** (Biome under the hood; config in `biome.jsonc`). `fix` also runs on staged files through husky + lint-staged on commit.
- `pnpm typecheck` — `tsc --noEmit`
- Tests — Playwright e2e only (`pnpm test`); polls `/`. Single file: `pnpm exec playwright test tests/e2e/chat.test.ts`.

Env vars (all optional, see `.env.example`): `HERMES_ACP_HOME` (default `~/.hermes/hermes-agent`), `HERMES_ACP_PYTHON` (default `<home>/venv/bin/python`), `ACP_DEBUG`, `<PROFILE>_HERMES_HOME` per profile entry.

## Architecture (UI)

`app/(chat)/page.tsx` and `chat/[id]/page.tsx` return `null`; the UI is mounted by `app/(chat)/layout.tsx` (`ActiveChatProvider` → `SidebarProvider` → `AppSidebar` + `ChatShell`). `hooks/use-active-chat.tsx` owns the `useChat` state and the memoized `DefaultChatTransport` (mutable state — agent id, resolved chat id — is read through refs at send time, never closures). `components/chat/data-stream-handler.tsx` drains custom `data-*` parts for the artifact state machine. `lib/types.ts` declares `ChatMessage` (with `CustomUIDataTypes` incl. `"session-id"`) and local `Chat`/`Document`/`Vote`/`Suggestion` types. `ChatbotError` (`lib/errors.ts`) stays the error envelope for everything fetch-shaped.

Still stubbed with `TODO(ACP)`: votes, document artifact persistence, attachments/upload, delete chat / delete-all (deletion needs a `session/delete` ACP method on the Hermes side — separate issue).

## Conventions
- Lint/format: Biome via ultracite, 2-space indent. `biome.jsonc` **excludes** `components/ui`, `components/ai-elements`, `components/elements`, `lib/utils.ts`, and `hooks/use-mobile.ts` — vendored files; match their existing style, don't reformat.
- Path alias: `@/*` → repo root.
- React Compiler is on and `cacheComponents` is enabled — prefer Server Components; only opt into `"use client"` where hooks/events are needed.
- Mark any still-stubbed backend interaction with a `TODO(ACP)` comment describing the contract.
