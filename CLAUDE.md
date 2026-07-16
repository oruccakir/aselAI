# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This started as the Vercel **Chatbot** template (Next.js 16 App Router + AI SDK 7), customized as `aselAI`. The backend (auth, database, API routes, AI provider calls, rate limiting, bot protection, observability) has been **fully removed** per [GitHub issue #1](https://github.com/oruccakir/aselAI/issues/1). What remains is a frontend-only chat UI that will connect to an external agent over the Agent Context / Model Context Protocol (e.g. a Hermes-style agent) in a follow-up.

## The ACP integration points

Every place where the removed backend used to be called is marked with a `TODO(ACP)` comment (grep for it). The most important ones:

- **`lib/chat-transport.ts`** — `StubChatTransport`, the single integration point for sending messages. It implements the AI SDK `ChatTransport` interface with a no-op (empty stream). Its doc comment records the request-body contract the old backend expected, including the tool-approval continuation flow.
- **`hooks/use-active-chat.tsx`** — nulled SWR keys for loading persisted messages and votes; the transport is instantiated here.
- **`components/chat/sidebar-history.tsx`** — nulled `useSWRInfinite` key for chat history (expects `{ chats: Chat[]; hasMore: boolean }` pages).
- **`components/chat/artifact.tsx` / `document-preview.tsx` / `version-footer.tsx`** — nulled document-version fetches; artifact edits live only in SWR cache memory.
- **`lib/models.ts`** — static `chatModels` list and an all-false `modelCapabilities` map; both should eventually come from the agent.
- **`app/(chat)/layout.tsx`** — static `STUB_USER`; real identity should come from the agent.

Message sending currently no-ops: the user message renders, the stream closes immediately, no assistant reply appears.

## Commands

Package manager is **pnpm** (`packageManager: pnpm@10.32.1`). No environment variables are required.

- `pnpm dev` — start dev server (Turbopack) on :3000
- `pnpm build` — production build (`next build`)
- `pnpm start` — serve the production build
- `pnpm check` / `pnpm fix` — lint/autofix via **ultracite** (Biome under the hood; config in `biome.jsonc`). `fix` also runs on staged files through husky + lint-staged on commit.
- `pnpm typecheck` — `tsc --noEmit`
- Tests — Playwright e2e only (`pnpm test`). The script sets `PLAYWRIGHT=True`, boots `pnpm dev` as the `webServer`, and polls `/`. Run a single test file: `pnpm exec playwright test tests/e2e/chat.test.ts`. UI mode: `pnpm exec playwright test --ui`.

## Architecture

### Routing & shell
There is no middleware/proxy and no API route — everything is UI. `app/(chat)/page.tsx` and `app/(chat)/chat/[id]/page.tsx` both return `null`; the real UI is mounted by **`app/(chat)/layout.tsx`** (`SidebarShell` → `AppSidebar` + `ActiveChatProvider` → `ChatShell`). The active chat id is derived client-side from `usePathname()` inside `ActiveChatProvider` (`hooks/use-active-chat.tsx`), which owns the `useChat` state (messages, status, votes, model id, visibility) and provides it via context.

### Types & models
- `lib/types.ts` — `ChatMessage` (AI SDK `UIMessage` with `MessageMetadata`, `CustomUIDataTypes`, `ChatTools`), plus plain local replacements for the former DB types (`AppUser`, `Chat`, `Document`, `Suggestion`, `Vote`, `DBMessage`). The `ChatTools` input/output shapes are inlined here.
- `lib/models.ts` — `chatModels`, `DEFAULT_CHAT_MODEL`, `ModelCapabilities`, static `modelCapabilities`. To add/remove a model, edit this array.

### Artifacts (client-only)
Artifact definitions live in `artifacts/<kind>/client.tsx` (`text | code | image | sheet`), assembled into `artifactDefinitions` in `components/chat/artifact.tsx`. `components/chat/data-stream-handler.tsx` drains the client data stream, applies per-kind `onStreamPart` (custom parts: `data-id`/`data-title`/`data-kind`/`data-clear`/`data-textDelta`/`data-codeDelta`/`data-sheetDelta`/`data-suggestion`/`data-finish`, declared in `lib/types.ts` as `CustomUIDataTypes`), and drives the `useArtifact` state machine. The code artifact executes Python via Pyodide in the browser.

### Errors
`ChatbotError` (`lib/errors.ts`) is still the error envelope the UI understands — `lib/utils.ts` `fetcher`/`fetchWithErrorHandlers` throw it and `use-active-chat`'s `onError` toasts it. Keep using it for anything fetch-shaped.

## Conventions
- Lint/format: Biome via ultracite, 2-space indent. `biome.jsonc` **excludes** `components/ui`, `components/ai-elements`, `components/elements`, `lib/utils.ts`, and `hooks/use-mobile.ts` from formatting/linting — these are vendored shadcn/utility files; match their existing style, don't reformat.
- Path alias: `@/*` → repo root (see `tsconfig.json`).
- React Compiler is on (`next.config.ts` `reactCompiler: true`) and `cacheComponents` is enabled — prefer Server Components and Server Actions; only opt into `"use client"` where hooks/events are needed.
- Mark any new stubbed-out backend interaction with a `TODO(ACP)` comment describing the old contract so the future integration has a spec to follow.
