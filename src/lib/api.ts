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

// Same-origin: next.config.ts proxies /api/* and /connected-accounts to the backend.
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
