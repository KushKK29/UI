// Thin client for the connector's /api JSON endpoints. Bearer session token
// in localStorage — the backend takes no cookies for this API.

export const store = {
  get: (k: string): string | null => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {}
  },
};

export type Status = {
  email: string;
  connections: Record<string, unknown>;
  digest_project_gid?: string | null;
};

export type Confirm = (name: string, preview: unknown) => Promise<boolean>;

// Same-origin: next.config.ts proxies /api/* to the backend.
export const hasToken = () => !!store.get("ops_token");
export class AuthError extends Error {}

async function req(method: string, path: string, body?: unknown): Promise<any> {
  const token = store.get("ops_token");
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    store.set("ops_token", null);
    throw new AuthError(data.detail || "not authenticated");
  }
  if (!res.ok) throw new Error(data.detail || `${res.status} ${res.statusText}`);
  return data;
}

export async function login(email: string, password: string) {
  const { token } = await req("POST", "/api/session/login", { email, password });
  store.set("ops_token", token);
}

export async function signup(email: string, password: string) {
  const { token } = await req("POST", "/api/session/signup", { email, password });
  store.set("ops_token", token);
}

export async function logout() {
  try {
    await req("POST", "/api/session/logout");
  } catch {}
  store.set("ops_token", null);
}

export const status = (): Promise<Status> => req("GET", "/api/ops/status");
export const setDigestProject = (project_gid: string) =>
  req("PUT", "/api/ops/digest-settings", { project_gid });

// Runs a tool. Write tools answer the first call with {preview, confirm_token};
// `confirm(name, preview)` asks the user, and on yes the same call is repeated
// with the token. Returns the final result, or null if the user declined.
export async function run(name: string, args: object, confirm: Confirm): Promise<any> {
  let out = await req("POST", `/api/ops/tools/${name}`, { args });
  if (out.confirm_token) {
    if (!(await confirm(name, out.preview))) return null;
    out = await req("POST", `/api/ops/tools/${name}`, { args, confirm_token: out.confirm_token });
  }
  return out;
}

export type Provider = {
  provider: string;
  name: string;
  favicon: string;
  tool_count: number;
  state: "connected" | "api_key" | "available" | "not_configured";
  status?: string;
  last_used_at?: number | null;
  env?: string[];
};
export type AccountDetail = {
  name: string;
  favicon: string;
  last_used_at?: number | null;
  server_url: string;
  instructions: string;
  tools: { name: string; description: string; requires_confirm: boolean; schema: unknown }[];
};

export const accounts = (): Promise<{ providers: Provider[] }> => req("GET", "/api/accounts");
export const accountDetail = (p: string): Promise<AccountDetail> => req("GET", `/api/accounts/${p}`);
export const connectFreshdesk = (domain: string, api_key: string) =>
  req("POST", "/api/accounts/freshdesk", { domain, api_key });
export const disconnect = (p: string) => req("DELETE", `/api/accounts/${p}`);
export const connectUrl = (p: string): Promise<{ url: string }> => req("POST", `/api/accounts/${p}/connect`);

export type DupGroup = {
  email: string;
  members: { provider: string; id: string; name: string | null; company: string | null }[];
  conflicting_fields: Record<string, Record<string, string>>;
  recommended_primary: string;
};
export type Duplicates = {
  providers_checked: string[];
  providers_skipped: Record<string, string>;
  duplicate_groups: DupGroup[];
  total_contacts_checked: number;
};
export type QualityResult = {
  providers_checked: string[];
  providers_skipped: Record<string, string>;
  results: Record<string, {
    total_contacts: number;
    flagged_count: number;
    quality_score: number | null;
    flagged: { id: string; name: string | null; issues: string[]; severity: "high" | "medium" | "low" }[];
  }>;
};
export type SearchResult = {
  query: string;
  providers_checked: string[];
  providers_skipped: Record<string, string>;
  found_in: string[];
  records: { provider: string; id: string; name: string | null; email: string | null; phone: string | null; company: string | null }[];
};
export type FuzzyDupGroup = DupGroup & { confidence: "exact" | "high" | "medium" };
export type FuzzyDuplicates = {
  providers_checked: string[];
  providers_skipped: Record<string, string>;
  duplicate_groups: FuzzyDupGroup[];
  total_contacts_checked: number;
};
export type ConflictField = {
  values: Record<string, string>;
  suggested_value: string | null;
  suggested_from: string | null;
  basis: "most_recent_activity" | "no_timestamp_available";
};
export type ConflictGroup = {
  email: string;
  members: { provider: string; id: string; name: string | null; company: string | null }[];
  conflicting_fields: Record<string, ConflictField>;
};
export type ConflictsResult = {
  providers_checked: string[];
  providers_skipped: Record<string, string>;
  conflict_groups: ConflictGroup[];
  total_conflicts: number;
};
export type StaleContact = {
  provider: string; id: string; name: string | null; email: string | null;
  company: string | null; last_activity: string | null; idle_days: number | null;
};
export type StaleResult = {
  providers_checked: string[];
  providers_skipped: Record<string, string>;
  freshdesk_checked: boolean;
  days_threshold: number;
  stale_contacts: StaleContact[];
  total_contacts_checked: number;
};

export const crmDuplicates = (): Promise<Duplicates> => req("GET", "/api/crm-ops/duplicates");
export const crmQuality = (): Promise<QualityResult> => req("GET", "/api/crm-ops/quality");
export const crmSearch = (q: string): Promise<SearchResult> => req("GET", `/api/crm-ops/search?q=${encodeURIComponent(q)}`);
export const crmDuplicatesFuzzy = (): Promise<FuzzyDuplicates> => req("GET", "/api/crm-ops/duplicates-fuzzy");
export const crmConflicts = (): Promise<ConflictsResult> => req("GET", "/api/crm-ops/conflicts");
export const crmStale = (days: number): Promise<StaleResult> => req("GET", `/api/crm-ops/stale?days=${days}`);
