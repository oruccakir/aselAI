import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";

/**
 * Generic ACP (Agent Client Protocol) client that drives an external agent
 * over newline-delimited JSON-RPC 2.0 on a long-lived child process.
 *
 * The external agent is the "brain" — it owns its own tools, skills, memory
 * and conversation history. This client opens a connection, forwards prompts,
 * and streams `session/update` notifications back to the caller. Translation
 * of those updates into AI SDK UIMessageChunks lives in ui-stream.ts.
 *
 * Ported from cakir-ai's acpAgentClient.ts with one deliberate deviation:
 * that client kept ONE global session (one long-running conversation); here
 * every chat is its own session, so session creation is explicit and the
 * active-prompt bookkeeping is per session.
 *
 * Wire facts (confirmed against the acp spec + the reference agents):
 *  - Framing: one JSON object per line, terminated by "\n" (NOT LSP
 *    Content-Length).
 *  - Params are camelCase (protocolVersion, sessionId, ...).
 *  - Methods: initialize, session/new, session/list, session/load,
 *    session/prompt, session/cancel; agent->client reverse request
 *    session/request_permission.
 */

export type AcpUpdate = Record<string, unknown> & { sessionUpdate?: string };

export type AcpPromptBlock =
  | { type: "text"; text: string }
  | { type: "image"; data?: string; uri?: string; mimeType?: string };

export type AcpSessionInfo = {
  sessionId: string;
  cwd?: string;
  title?: string | null;
  updatedAt?: string | null;
};

export type AcpSessionListResponse = {
  sessions: AcpSessionInfo[];
  nextCursor?: string | null;
};

export type AcpPermissionOption = {
  optionId: string;
  name: string;
  kind: string;
};

/**
 * Process-global registry of in-flight permission requests. Clients are
 * singletons per agent, but a permission's answer arrives out-of-band (a
 * separate HTTP request from the UI), so pending resolvers are keyed by a
 * process-unique requestId and resolved from anywhere.
 */
type PendingPermission = {
  resolve: (optionId: string | null) => void;
  options: AcpPermissionOption[];
};
const pendingPermissions = new Map<string, PendingPermission>();
let permissionSeq = 0;

const ALLOW_OPTION_PATTERN = /allow|proceed|yes/i;

/**
 * Answer a pending permission request with a boolean decision. The concrete
 * ACP optionId is resolved server-side from the agent-supplied options
 * (AI SDK approval responses carry no optionId): approved → the first option
 * matching /allow|proceed|yes/i, preferring exact "allow_once"; denied →
 * null, which the client answers as a cancelled outcome.
 * Idempotent: a second answer for the same requestId is a no-op.
 */
export function resolveAcpPermissionByDecision(
  requestId: string,
  approved: boolean
): boolean {
  const entry = pendingPermissions.get(requestId);
  if (!entry) {
    return false;
  }
  if (!approved) {
    entry.resolve(null);
    return true;
  }
  const allowOption =
    entry.options.find((option) => option.optionId === "allow_once") ??
    entry.options.find(
      (option) =>
        ALLOW_OPTION_PATTERN.test(option.optionId) ||
        ALLOW_OPTION_PATTERN.test(option.name)
    ) ??
    entry.options.at(0);
  entry.resolve(allowOption?.optionId ?? null);
  return true;
}

export type AcpSpawnSpec = {
  /** Short label for logs, e.g. "hermes-acp". */
  label: string;
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  /** Extra params merged into session/new and session/load request bodies. */
  sessionParams?: Record<string, unknown>;
};

const ACP_PROTOCOL_VERSION = 1;
/** Deliberately under the agent's own ~60s permission timeout. */
const PERMISSION_TIMEOUT_MS = 55_000;

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export class AcpAgentClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private stdoutBuffer = "";
  private initializePromise: Promise<void> | null = null;

  /** In-flight prompt turns, keyed by sessionId — two chats never serialize. */
  private readonly activePrompts = new Map<string, Promise<unknown>>();

  /** Per-session listeners for `session/update` notifications. */
  private readonly sessionListeners = new Map<
    string,
    (update: AcpUpdate) => void
  >();

  private readonly spec: AcpSpawnSpec;

  constructor(spec: AcpSpawnSpec) {
    this.spec = spec;
  }

  // ---- process lifecycle -------------------------------------------------

  private ensureStarted(): ChildProcessWithoutNullStreams {
    if (this.child && !this.child.killed) {
      return this.child;
    }

    const child = spawn(this.spec.command, this.spec.args, {
      cwd: this.spec.cwd,
      env: this.spec.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.onStdout(chunk));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      // The agent logs to stderr; surface only when explicitly debugging.
      if (process.env.ACP_DEBUG) {
        process.stderr.write(`[${this.spec.label}] ${chunk}`);
      }
    });
    child.on("error", (error) => {
      // e.g. spawn ENOENT when HERMES_ACP_HOME/PYTHON is wrong — without
      // this handler the error escapes as an uncaughtException.
      console.warn(`[${this.spec.label}] failed to start: ${error.message}`);
      this.reset(
        new Error(`${this.spec.label} failed to start: ${error.message}`)
      );
    });
    child.on("exit", (code) => {
      console.warn(
        `[${this.spec.label}] process exited (code=${code}); resetting connection`
      );
      this.reset(new Error(`${this.spec.label} exited with code ${code}`));
    });

    this.child = child;
    return child;
  }

  private reset(error: Error): void {
    for (const { reject } of this.pending.values()) {
      reject(error);
    }
    this.pending.clear();
    this.sessionListeners.clear();
    this.activePrompts.clear();
    this.child = null;
    this.initializePromise = null;
    this.stdoutBuffer = "";
  }

  // ---- JSON-RPC plumbing -------------------------------------------------

  private write(message: Record<string, unknown>): void {
    const child = this.ensureStarted();
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private request<T = unknown>(
    method: string,
    params: Record<string, unknown>
  ): Promise<T> {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        reject,
        resolve: resolve as (v: unknown) => void,
      });
      this.write({ id, jsonrpc: "2.0", method, params });
    });
  }

  private respond(id: number | string, result: Record<string, unknown>): void {
    this.write({ id, jsonrpc: "2.0", result });
  }

  private respondError(
    id: number | string,
    code: number,
    message: string
  ): void {
    this.write({ error: { code, message }, id, jsonrpc: "2.0" });
  }

  private onStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    let nl = this.stdoutBuffer.indexOf("\n");
    while (nl !== -1) {
      const line = this.stdoutBuffer.slice(0, nl).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(nl + 1);
      if (line) {
        try {
          this.dispatch(JSON.parse(line));
        } catch {
          // ignore non-JSON noise on stdout
        }
      }
      nl = this.stdoutBuffer.indexOf("\n");
    }
  }

  private dispatch(msg: Record<string, unknown>): void {
    const id = msg.id as number | undefined;

    // Response to one of our requests.
    if (id !== undefined && ("result" in msg || "error" in msg)) {
      const pending = this.pending.get(id);
      if (!pending) {
        return;
      }
      this.pending.delete(id);
      if ("error" in msg) {
        pending.reject(new Error(JSON.stringify(msg.error)));
      } else {
        pending.resolve(msg.result);
      }
      return;
    }

    const method = msg.method as string | undefined;

    // Reverse request from the agent (has method + id).
    if (method && id !== undefined) {
      if (method === "session/request_permission") {
        this.handlePermissionRequest(
          id,
          msg.params as Record<string, unknown> | undefined
        );
        return;
      }
      // We advertise no fs/terminal client capabilities; reject anything else.
      this.respondError(id, -32_601, `method not found: ${method}`);
      return;
    }

    // Notification from the agent (method, no id).
    if (method === "session/update") {
      const params = msg.params as
        | { sessionId?: string; update?: AcpUpdate }
        | undefined;
      const sessionId = params?.sessionId;
      const update = params?.update;
      if (sessionId && update) {
        this.sessionListeners.get(sessionId)?.(update);
      }
    }
  }

  /**
   * The agent asks the user to confirm a dangerous action. Surface it to the
   * active turn's listener as a synthetic `x-permission-request` update and
   * wait for an out-of-band answer via resolveAcpPermissionByDecision().
   * Auto-denies on timeout or when no listener is registered.
   */
  private handlePermissionRequest(
    jsonRpcId: number,
    params: Record<string, unknown> | undefined
  ): void {
    const sessionId = params?.sessionId as string | undefined;
    const listener = sessionId
      ? this.sessionListeners.get(sessionId)
      : undefined;
    if (!listener) {
      this.respond(jsonRpcId, { outcome: { outcome: "cancelled" } });
      return;
    }

    permissionSeq += 1;
    const requestId = `perm-${permissionSeq}`;
    const timer: { handle?: ReturnType<typeof setTimeout> } = {};
    let settled = false;
    const finish = (optionId: string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer.handle) {
        clearTimeout(timer.handle);
      }
      pendingPermissions.delete(requestId);
      this.respond(
        jsonRpcId,
        optionId
          ? { outcome: { optionId, outcome: "selected" } }
          : { outcome: { outcome: "cancelled" } }
      );
    };
    timer.handle = setTimeout(() => finish(null), PERMISSION_TIMEOUT_MS);

    const rawOptions = Array.isArray(params?.options) ? params.options : [];
    const options: AcpPermissionOption[] = [];
    for (const raw of rawOptions as Record<string, unknown>[]) {
      const optionId = (raw.optionId ?? raw.option_id) as string | undefined;
      if (optionId) {
        options.push({
          kind: typeof raw.kind === "string" ? raw.kind : "",
          name: typeof raw.name === "string" ? raw.name : optionId,
          optionId,
        });
      }
    }
    pendingPermissions.set(requestId, { options, resolve: finish });

    listener({
      options: params?.options,
      requestId,
      sessionUpdate: "x-permission-request",
      toolCall: params?.toolCall,
    } as AcpUpdate);
  }

  // ---- handshake ---------------------------------------------------------

  private ensureInitialized(): Promise<void> {
    if (!this.initializePromise) {
      this.initializePromise = this.request("initialize", {
        clientCapabilities: {
          fs: { readTextFile: false, writeTextFile: false },
          terminal: false,
        },
        clientInfo: { name: "aselAI", version: "0.1.0" },
        protocolVersion: ACP_PROTOCOL_VERSION,
      }).then(() => undefined);
    }
    return this.initializePromise;
  }

  // ---- public API --------------------------------------------------------

  /** True if a prompt turn is in flight for the given session. */
  isBusy(sessionId: string): boolean {
    return this.activePrompts.has(sessionId);
  }

  /**
   * Cancel the in-flight prompt turn for a session (if any) and wait for it
   * to settle, so a new prompt can take over (latest-wins) instead of being
   * dropped. If the agent honors the cancel this returns quickly; if not, it
   * waits for the current turn to finish rather than overlapping two prompts
   * on one session. Without the await, a slow cancel would wedge the session
   * busy and silently drop every subsequent prompt. Safe to call when idle.
   */
  async cancelActivePrompt(sessionId: string): Promise<void> {
    const active = this.activePrompts.get(sessionId);
    if (!active) {
      return;
    }
    await this.request("session/cancel", { sessionId }).catch(() => {
      // Cancel failed — fall through and just wait for the turn to settle.
    });
    await active.catch(() => {
      // The turn's own error is the prompt caller's to handle.
    });
  }

  async newSession(): Promise<string> {
    await this.ensureInitialized();
    const res = await this.request<{ sessionId: string }>("session/new", {
      cwd: this.spec.cwd,
      mcpServers: [],
      ...this.spec.sessionParams,
    });
    return res.sessionId;
  }

  async listSessions(
    opts: { cursor?: string | null } = {}
  ): Promise<AcpSessionListResponse> {
    await this.ensureInitialized();
    const params: Record<string, unknown> = {};
    if (opts.cursor) {
      params.cursor = opts.cursor;
    }
    const res = await this.request<AcpSessionListResponse>(
      "session/list",
      params
    );
    return {
      nextCursor: res.nextCursor ?? null,
      sessions: Array.isArray(res.sessions) ? res.sessions : [],
    };
  }

  async loadSession(
    sessionId: string,
    handlers: { onUpdate?: (update: AcpUpdate) => void; signal?: AbortSignal }
  ): Promise<void> {
    const targetSessionId = sessionId.trim();
    if (!targetSessionId) {
      throw new Error("sessionId is required");
    }

    await this.cancelActivePrompt(targetSessionId);
    await this.ensureInitialized();

    const listener = handlers.onUpdate;
    if (listener) {
      this.sessionListeners.set(targetSessionId, listener);
    }

    const onAbort = () => {
      this.request("session/cancel", { sessionId: targetSessionId }).catch(
        () => {
          // Best-effort cancel on abort.
        }
      );
    };
    handlers.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const res = await this.request<Record<string, unknown> | null>(
        "session/load",
        {
          cwd: this.spec.cwd,
          mcpServers: [],
          sessionId: targetSessionId,
          ...this.spec.sessionParams,
        }
      );
      if (res === null) {
        throw new Error(`Session not found: ${targetSessionId}`);
      }
    } finally {
      handlers.signal?.removeEventListener("abort", onAbort);
      if (listener) {
        this.sessionListeners.delete(targetSessionId);
      }
    }
  }

  async prompt(
    sessionId: string,
    prompt: AcpPromptBlock[],
    handlers: { onUpdate: (update: AcpUpdate) => void; signal?: AbortSignal }
  ): Promise<string> {
    if (this.activePrompts.has(sessionId)) {
      throw new Error(
        `${this.spec.label} prompt is already running for session ${sessionId}; cancel it before sending another prompt.`
      );
    }

    const runPrompt = this.runPrompt(sessionId, prompt, handlers);
    this.activePrompts.set(sessionId, runPrompt);
    try {
      return await runPrompt;
    } finally {
      if (this.activePrompts.get(sessionId) === runPrompt) {
        this.activePrompts.delete(sessionId);
      }
    }
  }

  private async runPrompt(
    sessionId: string,
    prompt: AcpPromptBlock[],
    handlers: { onUpdate: (update: AcpUpdate) => void; signal?: AbortSignal }
  ): Promise<string> {
    await this.ensureInitialized();
    this.sessionListeners.set(sessionId, handlers.onUpdate);

    const onAbort = () => {
      this.request("session/cancel", { sessionId }).catch(() => {
        // Best-effort cancel on abort.
      });
    };
    handlers.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const res = await this.request<{ stopReason?: string }>(
        "session/prompt",
        { prompt, sessionId }
      );
      return res.stopReason ?? "end_turn";
    } finally {
      handlers.signal?.removeEventListener("abort", onAbort);
      this.sessionListeners.delete(sessionId);
    }
  }
}
