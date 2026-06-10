import type { AssemblePayload, DebugHtmlPayload } from "./api.js";

export interface ContextFabricClientOptions {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
  /** Abort requests that take longer than this many milliseconds. Default: 30000. Pass 0 to disable. */
  timeoutMs?: number;
}

/** Per-call options. A caller-supplied signal is combined with the client timeout. */
export interface RequestOptions {
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const ERROR_BODY_EXCERPT_LIMIT = 300;

/**
 * Error thrown for non-2xx responses. Carries the status and a bounded excerpt
 * of the response body so callers can diagnose failures without re-fetching.
 */
export class ContextFabricRequestError extends Error {
  readonly status: number;
  readonly bodyExcerpt: string;

  constructor(path: string, status: number, bodyExcerpt: string) {
    const detail = bodyExcerpt ? `: ${bodyExcerpt}` : "";
    super(`Context Fabric request to ${path} failed with status ${status}${detail}`);
    this.name = "ContextFabricRequestError";
    this.status = status;
    this.bodyExcerpt = bodyExcerpt;
  }
}

export class ContextFabricClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: ContextFabricClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async health(options: RequestOptions = {}): Promise<unknown> {
    return this.getJson("/health", options);
  }

  async assemble(payload: AssemblePayload, options: RequestOptions = {}): Promise<unknown> {
    return this.postJson("/assemble", payload, options);
  }

  async debugHtml(payload: DebugHtmlPayload, options: RequestOptions = {}): Promise<string> {
    const response = await this.post("/debug/html", payload, options);
    return response.text();
  }

  private signalFor(options: RequestOptions): AbortSignal | undefined {
    const signals: AbortSignal[] = [];
    if (options.signal) signals.push(options.signal);
    if (this.timeoutMs > 0) signals.push(AbortSignal.timeout(this.timeoutMs));
    if (signals.length === 0) return undefined;
    return signals.length === 1 ? signals[0] : AbortSignal.any(signals);
  }

  private async getJson(path: string, options: RequestOptions): Promise<unknown> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      headers: this.headers(),
      signal: this.signalFor(options),
    });
    await this.ensureOk(path, response);
    return response.json();
  }

  private async postJson(
    path: string,
    payload: unknown,
    options: RequestOptions,
  ): Promise<unknown> {
    const response = await this.post(path, payload, options);
    return response.json();
  }

  private async post(path: string, payload: unknown, options: RequestOptions): Promise<Response> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers({ "content-type": "application/json" }),
      body: JSON.stringify(payload),
      signal: this.signalFor(options),
    });
    await this.ensureOk(path, response);
    return response;
  }

  private async ensureOk(path: string, response: Response): Promise<void> {
    if (response.ok) return;
    let excerpt = "";
    try {
      excerpt = (await response.text()).slice(0, ERROR_BODY_EXCERPT_LIMIT).trim();
    } catch {
      // Body unavailable (already consumed / stream error): report status alone.
    }
    throw new ContextFabricRequestError(path, response.status, excerpt);
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return this.token ? { ...extra, authorization: `Bearer ${this.token}` } : extra;
  }
}
