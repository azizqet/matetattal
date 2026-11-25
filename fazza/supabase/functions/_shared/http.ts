export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

/** Error responses carry a stable FZ_* code that the clients translate. */
export function fail(code: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return json({ error: code, ...extra }, status);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    const text = await req.text();
    if (text.length > 20_000) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("FZ_METHOD_NOT_ALLOWED", 405);
  return null;
}
