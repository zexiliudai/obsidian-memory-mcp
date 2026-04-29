export type ObsidianConfig = {
  baseUrl: string;
  apiKey?: string;
  verifyTls: boolean;
};

export type FetchLike = (request: Request) => Promise<Response>;

export type ResponseFormat = "markdown" | "note-json" | "document-map";
export type TargetType = "heading" | "block" | "frontmatter";
export type PatchOperation = "append" | "prepend" | "replace";

export class MissingApiKeyError extends Error {
  constructor() {
    super("OBSIDIAN_API_KEY is required for this Obsidian Local REST API operation.");
    this.name = "MissingApiKeyError";
  }
}

export class ObsidianApiError extends Error {
  readonly status: number;
  readonly errorCode?: number;
  readonly responseBody?: unknown;

  constructor(status: number, message: string, errorCode?: number, responseBody?: unknown) {
    super(`Obsidian API returned ${status}: ${message}`);
    this.name = "ObsidianApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.responseBody = responseBody;
  }
}

export function loadObsidianConfig(
  env: Record<string, string | undefined> = process.env,
): ObsidianConfig {
  const baseUrl = (env.OBSIDIAN_BASE_URL ?? "https://127.0.0.1:27124").replace(/\/+$/, "");
  const verifyTls = env.OBSIDIAN_VERIFY_TLS === "true";

  return {
    baseUrl,
    apiKey: env.OBSIDIAN_API_KEY,
    verifyTls,
  };
}

export type TargetOptions = {
  targetType?: TargetType;
  target?: string;
  targetDelimiter?: string;
};

export class ObsidianClient {
  private readonly config: ObsidianConfig;
  private readonly fetchImpl: FetchLike;

  constructor(options: { config: ObsidianConfig; fetch?: FetchLike }) {
    this.config = options.config;
    this.fetchImpl = options.fetch ?? fetch;

    if (!this.config.verifyTls) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }
  }

  async status(): Promise<unknown> {
    return this.requestJson("/", { authRequired: false });
  }

  async listFiles(path = ""): Promise<unknown> {
    return this.requestJson(this.vaultPath(path), { method: "GET" });
  }

  async readNote(options: {
    path: string;
    responseFormat?: ResponseFormat;
    target?: TargetOptions;
  }): Promise<unknown> {
    const responseFormat = options.responseFormat ?? "markdown";
    const headers = new Headers();
    headers.set("Accept", acceptHeader(responseFormat));
    addTargetHeaders(headers, options.target);

    return this.request(this.vaultPath(options.path), { headers });
  }

  async writeNote(options: {
    path: string;
    content: string;
    contentType?: string;
    target?: TargetOptions;
  }): Promise<unknown> {
    const headers = new Headers();
    headers.set("Content-Type", options.contentType ?? "text/markdown");
    addTargetHeaders(headers, options.target);

    return this.request(this.vaultPath(options.path), {
      method: "PUT",
      headers,
      body: options.content,
    });
  }

  async appendNote(options: {
    path: string;
    content: string;
    contentType?: string;
    target?: TargetOptions;
    createTargetIfMissing?: boolean;
    applyIfContentPreexists?: boolean;
    trimTargetWhitespace?: boolean;
  }): Promise<unknown> {
    const headers = new Headers();
    headers.set("Content-Type", options.contentType ?? "text/markdown");
    addTargetHeaders(headers, options.target);
    addBooleanHeader(headers, "Create-Target-If-Missing", options.createTargetIfMissing);
    addBooleanHeader(headers, "Apply-If-Content-Preexists", options.applyIfContentPreexists);
    addBooleanHeader(headers, "Trim-Target-Whitespace", options.trimTargetWhitespace);

    return this.request(this.vaultPath(options.path), {
      method: "POST",
      headers,
      body: options.content,
    });
  }

  async patchNote(options: {
    path: string;
    content: string;
    operation: PatchOperation;
    targetType: TargetType;
    target: string;
    targetDelimiter?: string;
    contentType?: string;
    createTargetIfMissing?: boolean;
    applyIfContentPreexists?: boolean;
    trimTargetWhitespace?: boolean;
  }): Promise<unknown> {
    const headers = new Headers();
    headers.set("Content-Type", options.contentType ?? "text/markdown");
    headers.set("Operation", options.operation);
    headers.set("Target-Type", options.targetType);
    headers.set("Target", options.target);
    if (options.targetDelimiter) {
      headers.set("Target-Delimiter", options.targetDelimiter);
    }
    addBooleanHeader(headers, "Create-Target-If-Missing", options.createTargetIfMissing);
    addBooleanHeader(headers, "Apply-If-Content-Preexists", options.applyIfContentPreexists);
    addBooleanHeader(headers, "Trim-Target-Whitespace", options.trimTargetWhitespace);

    return this.request(this.vaultPath(options.path), {
      method: "PATCH",
      headers,
      body: options.content,
    });
  }

  async simpleSearch(query: string): Promise<unknown> {
    const params = new URLSearchParams({ query });
    return this.requestJson(`/search/simple/?${params.toString()}`, { method: "POST" });
  }

  async getTags(): Promise<unknown> {
    return this.requestJson("/tags/");
  }

  async openNote(options: { path: string; newLeaf?: boolean }): Promise<unknown> {
    const params = new URLSearchParams();
    if (options.newLeaf !== undefined) {
      params.set("newLeaf", String(options.newLeaf));
    }

    const query = params.size > 0 ? `?${params.toString()}` : "";
    return this.request(`/open/${encodeVaultPath(options.path)}${query}`, { method: "POST" });
  }

  private vaultPath(path: string): string {
    const normalized = path.replace(/^\/+/, "");
    return normalized ? `/vault/${encodeVaultPath(normalized)}` : "/vault/";
  }

  private async requestJson(
    path: string,
    init: RequestInit & { authRequired?: boolean } = {},
  ): Promise<unknown> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    return this.request(path, { ...init, headers });
  }

  private async request(
    path: string,
    init: RequestInit & { authRequired?: boolean } = {},
  ): Promise<unknown> {
    const authRequired = init.authRequired ?? true;
    if (authRequired && !this.config.apiKey) {
      throw new MissingApiKeyError();
    }

    const headers = new Headers(init.headers);
    if (this.config.apiKey) {
      headers.set("Authorization", `Bearer ${this.config.apiKey}`);
    }

    const response = await this.fetchImpl(
      new Request(`${this.config.baseUrl}${path}`, {
        ...init,
        headers,
      }),
    );

    if (!response.ok) {
      throw await parseApiError(response);
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    return response.text();
  }
}

function acceptHeader(format: ResponseFormat): string {
  if (format === "note-json") {
    return "application/vnd.olrapi.note+json";
  }
  if (format === "document-map") {
    return "application/vnd.olrapi.document-map+json";
  }
  return "text/markdown";
}

function encodeVaultPath(path: string): string {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function addTargetHeaders(headers: Headers, target?: TargetOptions) {
  if (!target) {
    return;
  }
  if (target.targetType) {
    headers.set("Target-Type", target.targetType);
  }
  if (target.target) {
    headers.set("Target", target.target);
  }
  if (target.targetDelimiter) {
    headers.set("Target-Delimiter", target.targetDelimiter);
  }
}

function addBooleanHeader(headers: Headers, name: string, value?: boolean) {
  if (value !== undefined) {
    headers.set(name, String(value));
  }
}

async function parseApiError(response: Response): Promise<ObsidianApiError> {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await response.json()) as { message?: string; errorCode?: number };
    return new ObsidianApiError(
      response.status,
      body.message ?? response.statusText,
      body.errorCode,
      body,
    );
  }

  const text = await response.text();
  return new ObsidianApiError(response.status, text || response.statusText, undefined, text);
}
