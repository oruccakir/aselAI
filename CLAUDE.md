# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is the Vercel **Chatbot** template (Next.js 16 App Router + AI SDK 7) customized as `aselAI`. It is a multi-model chat app with streaming, artifacts, auth, and persistence.

## Planned direction: backend removal

The backend (auth, database, API routes, AI provider calls, rate limiting) is slated for full removal. The app is moving to a frontend-only chat UI that will connect to an external agent over the Agent Context / Model Context Protocol (e.g. a Hermes-style agent) instead of calling models itself. See [GitHub issue #1](https://github.com/oruccakir/aselAI/issues/1) for the full removal plan and checklist.

Until that issue is resolved, the rest of this document (Commands, Architecture, Conventions) still describes the **current, backend-included** state of the repo accurately.

## Commands

Package manager is **pnpm** (`packageManager: pnpm@10.32.1`).

- `pnpm dev` — start dev server (Turbopack) on :3000
- `pnpm build` — runs `tsx lib/db/migrate` (applies migrations) **then** `next build`
- `pnpm start` — serve the production build
- `pnpm check` / `pnpm fix` — lint/autofix via **ultracite** (Biome under the hood; config in `biome.jsonc`). `fix` also runs on staged files through husky + lint-staged on commit.
- DB (Drizzle Kit, reads `POSTGRES_URL` from `.env.local`):
  - `pnpm db:generate` — create a new migration from `lib/db/schema.ts`
  - `pnpm db:migrate` — apply migrations (also runs in `build`)
  - `pnpm db:push` / `db:pull` / `db:check` / `db:up` / `db:studio`
- Tests — Playwright e2e only (`pnpm test`). The script sets `PLAYWRIGHT=True`, boots `pnpm dev` as the `webServer`, and polls `/ping`. Run a single test file: `pnpm exec playwright test tests/e2e/chat.test.ts`. UI mode: `pnpm exec playwright test --ui`.

Env vars come from `.env.local` (see `.env.example`): `AUTH_SECRET`, `POSTGRES_URL`, `REDIS_URL`, `BLOB_READ_WRITE_TOKEN`, and `AI_GATEWAY_API_KEY` (only needed off-Vercel; on Vercel the gateway uses OIDC).

## Architecture

### Routing & request lifecycle
Next.js 16 renamed `middleware` to `proxy` — the auth gate lives in **`proxy.ts`** (not `middleware.ts`). It short-circuits `/ping` → "pong", passes through `/api/auth`, redirects any other unauthenticated request to `/api/auth/guest?redirectUrl=…`, and bounces authenticated non-guests away from `/login` and `/register`.

Route groups: `app/(auth)` (login/register pages, NextAuth handlers, guest endpoint) and `app/(chat)` (the chat UI and all `/api/…` routes). Everything under `(chat)/api` requires a session.

### Auth (`app/(auth)/auth.ts`)
Auth.js v5 (`next-auth` beta) with two Credentials providers: a normal email/password one and a `guest` one that creates an ephemeral user via `createGuestUser`. The session carries `user.type: "guest" | "regular"`, which drives `lib/ai/entitlements.ts` (per-user-type `maxMessagesPerHour`). `DUMMY_PASSWORD` is always compared during lookup to keep timing constant when an email isn't found.

### The chat endpoint — `app/(chat)/api/chat/route.ts` (POST)
This is the heart of the app. Per request it:
1. Validates the body with `postRequestBodySchema` (`./schema.ts`), runs `botid` bot detection + `auth()` in parallel, enforces IP rate limiting (`lib/ratelimit.ts`, Redis-backed) and the per-hour message entitlement.
2. Loads existing chat+messages from the DB (or creates a `New chat` and kicks off async title generation via `generateTitleFromUserMessage` using `titleModel`).
3. Builds `uiMessages`, handling the **tool-approval flow**: when `messages` is present in the request, it merges prior DB messages with the client-sent approval states (`approval-responded` / `output-denied`) keyed by `toolCallId`.
4. Saves the incoming user message before streaming.
5. Looks up model **capabilities** (`getCapabilities`, cached 24h from the AI Gateway `/endpoints` API) to decide `isReasoningModel` and `supportsTools`. Reasoning models without tool support get `activeTools: []`.
6. Calls `streamText` with `getLanguageModel(chatModel)`, the system prompt from `lib/ai/prompts.ts` (which appends the artifacts prompt only when tools are supported), `stopWhen: isStepCount(5)`, and the five tools.
7. Wraps everything in `createUIMessageStream`. It emits custom `data-waiting-status` parts ("waiting" → health-check after 9s using `getModelAvailability` → "thinking" on first model activity) and `data-chat-title`. `onEnd` persists the finished assistant messages (or updates existing ones in the approval flow).
8. If `REDIS_URL` is set, the SSE stream is registered with `resumable-stream` (`createResumableStreamContext` using `after`) keyed by a stream id saved to the `Stream` table — this powers resume-after-refresh (`hooks/use-auto-resume.ts`). The resume route at `(chat)/api/chat/[id]/stream/route.ts` is currently a 204 stub.

All errors flow through the `ChatbotError` class (`lib/errors.ts`) and its `.toResponse()`.

### Models & providers (`lib/ai/`)
- `models.ts` — the `chatModels` array (id/name/provider/`gatewayOrder`/`reasoningEffort`), `DEFAULT_CHAT_MODEL`, `allowedModelIds`, `modelsByProvider`, plus gateway queries (`getCapabilities`, `getAllGatewayModels`, `getModelAvailability`). To add/remove a model, edit this array.
- `providers.ts` — `getLanguageModel`/`getTitleModel` use `gateway.languageModel(modelId)` (Vercel AI Gateway). In the **test environment** (`isTestEnvironment`, set by `PLAYWRIGHT*` env vars — see `lib/constants.ts`) it swaps to a `customProvider` with mock models from `models.mock.ts`, so e2e tests never hit the network.
- `prompts.ts` — `regularPrompt`, `artifactsPrompt` (the strict "one tool per turn / never echo artifact content" rules), per-artifact `code`/`sheet`/`updateDocument` prompts, and `titlePrompt`.

### Tools (`lib/ai/tools/`)
`createDocument`, `editDocument`, `updateDocument`, `requestSuggestions`, `getWeather`. The document tools write custom data parts (`data-kind`, `data-id`, `data-title`, `data-clear`, `data-textDelta`/`data-codeDelta`/`data-sheetDelta`, `data-finish`) onto the `UIMessageStreamWriter`; `editDocument` is a find-and-replace over the stored `Document.content` and is preferred over `updateDocument` (full rewrite) for targeted changes. These custom part types are declared as `CustomUIDataTypes` in `lib/types.ts`.

### Artifacts (server + client)
Two parallel registries keyed by `ArtifactKind` (`text | code | image | sheet`):
- **Server** (`lib/artifacts/server.ts` + `artifacts/<kind>/server.ts`): `createDocumentHandler` wraps per-kind `onCreateDocument`/`onUpdateDocument` (which `streamText` the content and stream deltas), persists via `saveDocument`, and is registered in `documentHandlersByArtifactKind`. Note `artifactKinds` is `["text","code","sheet"]` — `image` is client-only.
- **Client** (`artifacts/<kind>/client.tsx`): each exports an `artifactDefinition` with `onStreamPart`, assembled in `components/chat/artifact.tsx` into `artifactDefinitions`.

`components/chat/data-stream-handler.tsx` is the consumer: it drains the client data stream, applies per-kind `onStreamPart`, and drives the `useArtifact` state machine (`data-id`/`data-title`/`data-kind`/`data-clear`/`data-finish`). `data-chat-title` triggers an SWR mutate of the sidebar history.

### Database (`lib/db/`)
Drizzle ORM over `postgres-js`. `schema.ts` defines `User`, `Chat`, `Message_v2` (parts stored as JSON), `Vote_v2`, `Document` (composite PK `id`+`createdAt` — every save is a new versioned row), `Suggestion`, `Stream`. All queries are in `queries.ts` (`server-only`). Migrations live in `lib/db/migrations`; `migrate.ts` is run by `build`.

### Observability & bot protection
`instrumentation.ts` registers OpenTelemetry (`@ai-sdk/otel` + `@vercel/otel`, service `chatbot`). `botid` wraps `next.config.ts` and is also checked explicitly in the chat route.

## Conventions
- Lint/format: Biome via ultracite, 2-space indent. `biome.jsonc` **excludes** `components/ui`, `components/ai-elements`, `components/elements`, `lib/utils.ts`, and `hooks/use-mobile.ts` from formatting/linting — these are vendored shadcn/utility files; match their existing style, don't reformat.
- Path alias: `@/*` → repo root (see `tsconfig.json`).
- React Compiler is on (`next.config.ts` `reactCompiler: true`) and `cacheComponents` is enabled — prefer Server Components and Server Actions; only opt into `"use client"` where hooks/events are needed.
- API errors: throw/return `ChatbotError` and call `.toResponse()` rather than building ad-hoc `Response` objects, so error shapes stay consistent.