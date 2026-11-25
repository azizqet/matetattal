import { extractErrorCode } from "@fazza/shared";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { supabase } from "./supabase";

export class FzError extends Error {
  code: string;
  extra?: Record<string, unknown>;
  constructor(code: string, extra?: Record<string, unknown>) {
    super(code);
    this.code = code;
    this.extra = extra;
  }
}

export function toFzError(e: unknown): FzError {
  if (e instanceof FzError) return e;
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  return new FzError(extractErrorCode(msg));
}

/** Calls a Postgres function (all business rules are enforced server-side). */
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw new FzError(extractErrorCode(error.message));
    return data as T;
  } catch (e) {
    throw toFzError(e);
  }
}

/** Calls an Edge Function. */
export async function callFunction<T = unknown>(name: string, body: unknown, withAuth = false): Promise<T> {
  let token: string | undefined;
  if (withAuth) token = (await supabase.auth.getSession()).data.session?.access_token;
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new FzError("FZ_NETWORK");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new FzError(json?.error ?? "FZ_SERVER_ERROR", json);
  return json as T;
}

export function publicUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
