/**
 * Small browser client for the heynotai API-owned backend.
 *
 * It intentionally mirrors the subset of application backend's collection API used by
 * the web app and extension.  That lets the product move to PostgreSQL and
 * server-enforced authorization without rewriting every UI data adapter in a
 * single release.  This is a compatibility surface, not a generic public DB
 * API: the server keeps a strict collection allow-list and ownership rules.
 */

export type BackendRecord = Record<string, unknown> & {
  id: string;
  created: string;
  updated: string;
  collectionName?: string;
  expand?: Record<string, unknown>;
};

export type AuthRecord = BackendRecord & {
  email: string;
  name?: string;
  plan?: string;
  systemRole?: "admin" | "user";
};

export type AuthResponse<T extends AuthRecord = AuthRecord> = {
  token: string;
  refreshToken?: string;
  record: T;
};

export type ListResult<T> = {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
};

export type RealtimeEvent<T> = {
  action: "create" | "update" | "delete";
  record: T;
};

export class BackendResponseError extends Error {
  readonly status: number;
  readonly response: Record<string, unknown>;

  constructor(status: number, response: unknown, fallback = "request_failed") {
    const body = isObject(response) ? response : {};
    const message =
      typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : fallback;
    super(message);
    this.name = "BackendResponseError";
    this.status = status;
    this.response = body;
  }
}

export type AuthChangeListener = (
  token: string,
  record: AuthRecord | null,
) => void;

export interface AuthPersistence {
  load(): {
    token: string;
    refreshToken?: string;
    record: AuthRecord | null;
  } | null;
  save(token: string, record: AuthRecord | null, refreshToken?: string): void;
  clear(): void;
}

class LocalStoragePersistence implements AuthPersistence {
  constructor(private readonly key: string) {}

  load() {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        token?: unknown;
        record?: unknown;
      };
      return {
        token: typeof parsed.token === "string" ? parsed.token : "",
        refreshToken:
          typeof (parsed as { refreshToken?: unknown }).refreshToken === "string"
            ? (parsed as { refreshToken: string }).refreshToken
            : "",
        record: isObject(parsed.record)
          ? (parsed.record as AuthRecord)
          : null,
      };
    } catch {
      return null;
    }
  }

  save(token: string, record: AuthRecord | null, refreshToken = "") {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      this.key,
      JSON.stringify({ token, refreshToken, record }),
    );
  }

  clear() {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(this.key);
  }
}

export class BackendAuthStore {
  token = "";
  refreshToken = "";
  record: AuthRecord | null = null;
  private readonly listeners = new Set<AuthChangeListener>();

  constructor(
    private readonly persistence: AuthPersistence = new LocalStoragePersistence(
      "heynotai_auth",
    ),
  ) {
    const value = persistence.load();
    if (value) {
      this.token = value.token;
      this.refreshToken = value.refreshToken ?? "";
      this.record = value.record;
    }
  }

  get isValid(): boolean {
    // Backend sessions are opaque, so validity is confirmed by /auth/me.
    // A non-empty token means a session is available for that check.
    return this.token.length > 0;
  }

  save(
    token: string,
    record: AuthRecord | null,
    refreshToken = this.refreshToken,
  ): void {
    this.token = token;
    this.refreshToken = refreshToken;
    this.record = record;
    this.persistence.save(token, record, refreshToken);
    this.emit();
  }

  clear(): void {
    this.token = "";
    this.refreshToken = "";
    this.record = null;
    this.persistence.clear();
    this.emit();
  }

  /** Re-hydrate an async persistence implementation such as chrome.storage. */
  hydrate(
    token: string,
    record: AuthRecord | null,
    refreshToken = "",
  ): void {
    this.token = token;
    this.refreshToken = refreshToken;
    this.record = record;
    this.emit();
  }

  onChange(listener: AuthChangeListener, fireImmediately = false): () => void {
    this.listeners.add(listener);
    if (fireImmediately) listener(this.token, this.record);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) listener(this.token, this.record);
  }
}

type QueryOptions = {
  filter?: string;
  sort?: string;
  fields?: string;
  expand?: string;
  requestKey?: string | null;
};

type MutationOptions = { requestKey?: string | null };

type Subscription = {
  stopped: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

export class BackendClient {
  readonly authStore: BackendAuthStore;
  readonly files: {
    getURL: (record: Record<string, unknown>, filename: string) => string;
  };
  private readonly subscriptions = new Map<string, Subscription>();
  private refreshInFlight: Promise<void> | null = null;

  constructor(
    readonly baseUrl: string,
    authStore = new BackendAuthStore(),
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.authStore = authStore;
    this.files = {
      getURL: (record, filename) => {
        if (!filename) return "";
        if (/^https?:\/\//i.test(filename)) return filename;
        const collection =
          typeof record.collectionName === "string"
            ? record.collectionName
            : "users";
        const id = typeof record.id === "string" ? record.id : "";
        return `${this.baseUrl}/data/files/${encodeURIComponent(collection)}/${encodeURIComponent(id)}/${encodeURIComponent(filename)}`;
      },
    };
  }

  collection(name: string): CollectionClient {
    return new CollectionClient(this, name);
  }

  /** Safe parameter interpolation for the legacy filter compatibility API. */
  filter(template: string, params: Record<string, unknown>): string {
    return template.replace(/\{:(\w+)\}/g, (_match, key: string) =>
      encodeFilterValue(params[key]),
    );
  }

  async request<T>(
    path: string,
    init: RequestInit & { anonymous?: boolean } = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    if (!init.anonymous && this.authStore.token) {
      headers.set("Authorization", `Bearer ${this.authStore.token}`);
    }
    if (
      init.body &&
      !(init.body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }
    let response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    if (
      response.status === 401 &&
      !init.anonymous &&
      path !== "/auth/refresh" &&
      this.authStore.refreshToken
    ) {
      try {
        await this.refreshSession();
        headers.set("Authorization", `Bearer ${this.authStore.token}`);
        response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
      } catch {
        this.authStore.clear();
      }
    }
    const body =
      response.status === 204
        ? undefined
        : await response.json().catch(() => undefined);
    if (!response.ok) {
      throw new BackendResponseError(response.status, body);
    }
    return body as T;
  }

  async googlePopup<T extends AuthRecord>(): Promise<AuthResponse<T>> {
    if (typeof window === "undefined") {
      throw new BackendResponseError(400, {
        error: "oauth_browser_required",
      });
    }
    const width = 520;
    const height = 680;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
    const url = `${this.baseUrl}/auth/google/start?flow=popup&origin=${encodeURIComponent(window.location.origin)}`;
    const popup = window.open(
      url,
      "heynotai-google-auth",
      `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
    );
    if (!popup) {
      throw new BackendResponseError(400, { error: "oauth_popup_blocked" });
    }

    return new Promise<AuthResponse<T>>((resolve, reject) => {
      let settled = false;
      const finish = (result: AuthResponse<T> | Error) => {
        if (settled) return;
        settled = true;
        window.removeEventListener("message", onMessage);
        clearInterval(closedTimer);
        if (result instanceof Error) reject(result);
        else {
          this.authStore.save(result.token, result.record);
          resolve(result);
        }
      };
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== this.baseUrl) return;
        const data = event.data as Record<string, unknown> | null;
        if (!data || data.type !== "heynotai:google-oauth") return;
        if (data.error) {
          finish(
            new BackendResponseError(401, {
              error: String(data.error),
            }),
          );
          return;
        }
        if (typeof data.code !== "string") {
          finish(
            new BackendResponseError(502, { error: "invalid_oauth_response" }),
          );
          return;
        }
        void this.request<{
          accessToken: string;
          refreshToken: string;
          user: T;
        }>("/auth/google/exchange", {
          method: "POST",
          body: JSON.stringify({ code: data.code }),
          anonymous: true,
        })
          .then((result) => {
            this.authStore.save(
              result.accessToken,
              result.user,
              result.refreshToken,
            );
            finish({
              token: result.accessToken,
              refreshToken: result.refreshToken,
              record: result.user,
            });
          })
          .catch((error: unknown) =>
            finish(
              error instanceof Error
                ? error
                : new BackendResponseError(401, { error: "oauth_failed" }),
            ),
          );
      };
      window.addEventListener("message", onMessage);
      const closedTimer = setInterval(() => {
        if (popup.closed) {
          finish(new BackendResponseError(400, { error: "oauth_cancelled" }));
        }
      }, 400);
    });
  }

  private async refreshSession(): Promise<void> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = (async () => {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: this.authStore.refreshToken }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        accessToken?: string;
        refreshToken?: string;
        user?: AuthRecord;
      };
      if (
        !response.ok ||
        !body.accessToken ||
        !body.refreshToken ||
        !body.user
      ) {
        throw new BackendResponseError(response.status, body);
      }
      this.authStore.save(body.accessToken, body.user, body.refreshToken);
    })();
    try {
      await this.refreshInFlight;
    } finally {
      this.refreshInFlight = null;
    }
  }

  startPolling<T extends object>(
    collection: string,
    topic: string,
    callback: (event: RealtimeEvent<T>) => void,
  ): () => void {
    const key = `${collection}:${topic}`;
    this.stopPolling(collection, topic);
    const state: Subscription = { stopped: false, timer: null };
    this.subscriptions.set(key, state);
    let previous = new Map<string, string>();
    let initialized = false;

    const poll = async () => {
      if (state.stopped) return;
      try {
        const records =
          topic === "*"
            ? await this.collection(collection).getFullList<T>({
                sort: "-updated",
                requestKey: null,
              })
            : [await this.collection(collection).getOne<T>(topic)];
        const current = new Map<string, string>();
        for (const record of records) {
          const id = (record as { id?: unknown }).id;
          if (typeof id === "string") current.set(id, stableStringify(record));
        }
        if (initialized) {
          for (const record of records) {
            const recordId = (record as { id?: unknown }).id;
            if (typeof recordId !== "string") continue;
            const before = previous.get(recordId);
            const after = current.get(recordId);
            if (before === undefined) callback({ action: "create", record });
            else if (before !== after) callback({ action: "update", record });
          }
          for (const id of previous.keys()) {
            if (!current.has(id)) {
              callback({ action: "delete", record: { id } as unknown as T });
            }
          }
        }
        previous = current;
        initialized = true;
      } catch (error) {
        // A transient network error should not permanently kill realtime.
        // 401/403 are retried too because another tab may refresh the session.
        void error;
      } finally {
        if (!state.stopped) state.timer = setTimeout(poll, 1_500);
      }
    };
    void poll();
    return () => this.stopPolling(collection, topic);
  }

  stopPolling(collection: string, topic?: string): void {
    const prefix = `${collection}:`;
    for (const [key, state] of this.subscriptions) {
      if (!key.startsWith(prefix)) continue;
      if (topic !== undefined && key !== `${collection}:${topic}`) continue;
      state.stopped = true;
      if (state.timer) clearTimeout(state.timer);
      this.subscriptions.delete(key);
    }
  }
}

export class CollectionClient {
  constructor(
    private readonly backend: BackendClient,
    readonly name: string,
  ) {}

  async getOne<T extends object = BackendRecord>(
    id: string,
    options: QueryOptions = {},
  ): Promise<T> {
    return this.backend.request<T>(
      `/data/${encodeURIComponent(this.name)}/${encodeURIComponent(id)}${queryString(options)}`,
    );
  }

  async getList<T extends object = BackendRecord>(
    page = 1,
    perPage = 30,
    options: QueryOptions = {},
  ): Promise<ListResult<T>> {
    return this.backend.request<ListResult<T>>(
      `/data/${encodeURIComponent(this.name)}${queryString({
        ...options,
        page,
        perPage,
      })}`,
    );
  }

  async getFullList<T extends object = BackendRecord>(
    options: QueryOptions = {},
  ): Promise<T[]> {
    const result = await this.getList<T>(1, 500, options);
    if (result.totalPages <= 1) return result.items;
    const pages = await Promise.all(
      Array.from({ length: result.totalPages - 1 }, (_, index) =>
        this.getList<T>(index + 2, 500, options),
      ),
    );
    return [result, ...pages].flatMap((page) => page.items);
  }

  async getFirstListItem<T extends object = BackendRecord>(
    filter: string,
    options: QueryOptions = {},
  ): Promise<T> {
    const result = await this.getList<T>(1, 1, { ...options, filter });
    const first = result.items[0];
    if (!first) {
      throw new BackendResponseError(404, { error: "record_not_found" });
    }
    return first;
  }

  async create<T extends object = BackendRecord>(
    data: Record<string, unknown> | FormData,
    _options: MutationOptions = {},
  ): Promise<T> {
    if (this.name === "users" && !(data instanceof FormData)) {
      const result = await this.backend.request<{
        user: T;
        accessToken?: string;
        refreshToken?: string;
      }>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify(data),
          anonymous: true,
        },
      );
      if (result.accessToken) {
        this.backend.authStore.save(
          result.accessToken,
          result.user as unknown as AuthRecord,
          result.refreshToken ?? "",
        );
      }
      return result.user;
    }
    return this.backend.request<T>(`/data/${encodeURIComponent(this.name)}`, {
      method: "POST",
      body: data instanceof FormData ? data : JSON.stringify(data),
    });
  }

  async update<T extends object = BackendRecord>(
    id: string,
    data: Record<string, unknown> | FormData,
    _options: MutationOptions = {},
  ): Promise<T> {
    return this.backend.request<T>(
      `/data/${encodeURIComponent(this.name)}/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: data instanceof FormData ? data : JSON.stringify(data),
      },
    );
  }

  async delete(id: string, _options: MutationOptions = {}): Promise<boolean> {
    await this.backend.request<void>(
      `/data/${encodeURIComponent(this.name)}/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    return true;
  }

  async authWithPassword<T extends AuthRecord>(
    identity: string,
    password: string,
  ): Promise<AuthResponse<T>> {
    const response = await this.backend.request<{
      accessToken: string;
      refreshToken: string;
      user: T;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: identity, password }),
      anonymous: true,
    });
    const result = {
      token: response.accessToken,
      refreshToken: response.refreshToken,
      record: response.user,
    };
    this.backend.authStore.save(
      result.token,
      result.record,
      result.refreshToken,
    );
    return result;
  }

  async authRefresh<T extends AuthRecord>(): Promise<AuthResponse<T>> {
    const response = await this.backend.request<{ user: T }>("/auth/me");
    const result = {
      token: this.backend.authStore.token,
      record: response.user,
    };
    this.backend.authStore.save(result.token, result.record);
    return result;
  }

  async authWithOAuth2<T extends AuthRecord>(_options: {
    provider: string;
  }): Promise<AuthResponse<T>> {
    return this.backend.googlePopup<T>();
  }

  async requestEmailChange(email: string): Promise<void> {
    await this.backend.request<void>("/auth/email/change", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.backend.request<void>("/auth/password/reset", {
      method: "POST",
      body: JSON.stringify({ email }),
      anonymous: true,
    });
  }

  async requestOTP(_email: string): Promise<{ otpId: string }> {
    throw new BackendResponseError(501, { error: "mfa_not_configured" });
  }

  async authWithOTP<T extends AuthRecord>(
    _otpId?: string,
    _code?: string,
    _options?: Record<string, unknown>,
  ): Promise<AuthResponse<T>> {
    throw new BackendResponseError(501, { error: "mfa_not_configured" });
  }

  async subscribe<T extends object = BackendRecord>(
    topic: string,
    callback: (event: RealtimeEvent<T>) => void,
    _options?: QueryOptions,
  ): Promise<() => void> {
    return this.backend.startPolling(this.name, topic, callback);
  }

  async unsubscribe(topic?: string): Promise<void> {
    this.backend.stopPolling(this.name, topic);
  }
}

function queryString(options: QueryOptions & { page?: number; perPage?: number }) {
  const query = new URLSearchParams();
  for (const key of ["filter", "sort", "fields", "expand"] as const) {
    const value = options[key];
    if (typeof value === "string" && value.length > 0) query.set(key, value);
  }
  if (options.page) query.set("page", String(options.page));
  if (options.perPage) query.set("perPage", String(options.perPage));
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

function encodeFilterValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(String(value));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
