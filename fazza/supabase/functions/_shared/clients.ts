// Minimal, dependency-free clients for PostgREST, Auth admin and Storage.
// (No remote imports: functions boot fast and have no supply-chain surface.)

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Json = Record<string, unknown> | unknown[] | null;
export interface Result<T> { data: T | null; error: { message: string; status: number } | null }

async function call<T>(path: string, init: RequestInit & { key?: string; bearer?: string } = {}): Promise<Result<T>> {
  const key = init.key ?? SERVICE_KEY;
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${init.bearer ?? key}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const b = body as Record<string, unknown> | null;
    const message = String(b?.message ?? b?.msg ?? b?.error_description ?? b?.error ?? text ?? res.statusText);
    return { data: null, error: { message, status: res.status } };
  }
  return { data: body as T, error: null };
}

/** Service-role database access (bypasses RLS — only used after explicit checks). */
export const db = {
  rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<Result<T>> {
    return call<T>(`/rest/v1/rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
  },
  select<T = unknown>(table: string, query: string): Promise<Result<T[]>> {
    return call<T[]>(`/rest/v1/${table}?${query}`, { method: "GET" });
  },
  insert(table: string, row: Json): Promise<Result<unknown>> {
    return call(`/rest/v1/${table}`, { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=minimal" } });
  },
  update(table: string, query: string, patch: Json): Promise<Result<unknown>> {
    return call(`/rest/v1/${table}?${query}`, { method: "PATCH", body: JSON.stringify(patch), headers: { Prefer: "return=minimal" } });
  },
  delete(table: string, query: string): Promise<Result<unknown>> {
    return call(`/rest/v1/${table}?${query}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  },
};

/** RPC executed as the calling user (RLS and auth.uid() apply). */
export function rpcAsUser<T = unknown>(req: Request, fn: string, args: Record<string, unknown> = {}): Promise<Result<T>> {
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  return call<T>(`/rest/v1/rpc/${fn}`, { method: "POST", body: JSON.stringify(args), key: ANON_KEY, bearer: bearer || ANON_KEY });
}

export const authAdmin = {
  createUser(attrs: Record<string, unknown>) {
    return call<{ id: string }>(`/auth/v1/admin/users`, { method: "POST", body: JSON.stringify(attrs) });
  },
  updateUser(id: string, attrs: Record<string, unknown>) {
    return call<{ id: string }>(`/auth/v1/admin/users/${id}`, { method: "PUT", body: JSON.stringify(attrs) });
  },
  deleteUser(id: string) {
    return call(`/auth/v1/admin/users/${id}`, { method: "DELETE" });
  },
  getUserFromToken(token: string) {
    return call<{ id: string; phone?: string }>(`/auth/v1/user`, { method: "GET", key: ANON_KEY, bearer: token });
  },
};

export const storage = {
  list(bucket: string, prefix: string) {
    return call<Array<{ name: string; id: string | null }>>(`/storage/v1/object/list/${bucket}`, {
      method: "POST", body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
    });
  },
  remove(bucket: string, paths: string[]) {
    return call(`/storage/v1/object/${bucket}`, { method: "DELETE", body: JSON.stringify({ prefixes: paths }) });
  },
};

export interface SessionPayload {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: { id: string };
}

/** Calls the Auth server password grant. Returns the session or the auth error message. */
export async function passwordGrant(phoneE164: string, password: string):
  Promise<{ session?: SessionPayload; error?: string; status: number }> {
  const r = await call<SessionPayload>(`/auth/v1/token?grant_type=password`, {
    method: "POST", key: ANON_KEY, bearer: ANON_KEY,
    body: JSON.stringify({ phone: phoneE164.replace(/^\+/, ""), password }),
  });
  if (r.error) return { error: r.error.message, status: r.error.status };
  return { session: r.data!, status: 200 };
}

export async function revokeAccessToken(accessToken: string): Promise<void> {
  await call(`/auth/v1/logout?scope=local`, { method: "POST", key: ANON_KEY, bearer: accessToken }).catch(() => undefined);
}
