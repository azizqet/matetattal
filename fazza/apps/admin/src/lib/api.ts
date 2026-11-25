import { errorMessage, extractErrorCode } from "@fazza/shared";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "./supabase";
import { lang } from "./i18n";

export class FzError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new FzError(extractErrorCode(error.message));
  return data as T;
}

export async function callFunction<T = unknown>(name: string, body: unknown, auth = true): Promise<T> {
  const token = auth ? (await supabase.auth.getSession()).data.session?.access_token : undefined;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }).catch(() => { throw new FzError("FZ_NETWORK"); });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new FzError(json?.error ?? "FZ_SERVER_ERROR");
  return json as T;
}

export function errText(e: unknown): string {
  const code = e instanceof FzError ? e.code : extractErrorCode(e instanceof Error ? e.message : String(e));
  return errorMessage(code, lang());
}

export async function signedUrl(bucket: string, path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Prevent CSV formula injection in spreadsheet apps.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const csv = "﻿" + [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
