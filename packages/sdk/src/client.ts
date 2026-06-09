import type { AssemblePayload, DebugHtmlPayload } from "./api.js";

export interface ContextFabricClientOptions {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

export class ContextFabricClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ContextFabricClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async health(): Promise<unknown> {
    return this.getJson("/health");
  }

  async assemble(payload: AssemblePayload): Promise<unknown> {
    return this.postJson("/assemble", payload);
  }

  async debugHtml(payload: DebugHtmlPayload): Promise<string> {
    const response = await this.post("/debug/html", payload);
    return response.text();
  }

  private async getJson(path: string): Promise<unknown> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { headers: this.headers() });
    if (!response.ok) throw new Error(`Context Fabric request failed: ${response.status}`);
    return response.json();
  }

  private async postJson(path: string, payload: unknown): Promise<unknown> {
    const response = await this.post(path, payload);
    return response.json();
  }

  private async post(path: string, payload: unknown): Promise<Response> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers({ "content-type": "application/json" }),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Context Fabric request failed: ${response.status}`);
    return response;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return this.token ? { ...extra, authorization: `Bearer ${this.token}` } : extra;
  }
}
