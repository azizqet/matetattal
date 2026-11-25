// Forwards a notifications row to Expo Push (APNs / FCM). Called by a Postgres trigger via pg_net.
import { db } from "../_shared/clients.ts";
import { fail, json, readJson } from "../_shared/http.ts";

const SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";
const EXPO_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN") ?? "";

function safeEqual(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("FZ_METHOD_NOT_ALLOWED", 405);
  if (!safeEqual(req.headers.get("x-fazza-webhook-secret") ?? "", SECRET)) return fail("FZ_FORBIDDEN", 403);
  const body = await readJson<{ notification_id?: number }>(req);
  if (!body?.notification_id) return fail("FZ_BAD_REQUEST");

  interface N { id: number; user_id: string; type: string; title_ar: string; title_en: string; body_ar: string; body_en: string; data: Record<string, unknown>; pushed_at: string | null }
  const id = Number(body.notification_id);
  if (!Number.isInteger(id)) return fail("FZ_BAD_REQUEST");
  const { data: ns } = await db.select<N>("notifications", `select=*&id=eq.${id}`);
  const n = ns?.[0];
  if (!n || n.pushed_at) return json({ skipped: true });
  const [{ data: tokens }, { data: profiles }] = await Promise.all([
    db.select<{ token: string }>("push_tokens", `select=token&user_id=eq.${n.user_id}`),
    db.select<{ locale: string }>("profiles", `select=locale&id=eq.${n.user_id}`),
  ]);
  const profile = profiles?.[0];
  if (!tokens?.length) return json({ skipped: true });
  const ar = (profile?.locale ?? "ar") === "ar";
  const messages = tokens.map((t: { token: string }) => ({
    to: t.token,
    title: ar ? n.title_ar : n.title_en,
    body: (ar ? n.body_ar : n.body_en) || undefined,
    data: { ...n.data, type: n.type, notification_id: n.id },
    sound: "default",
    channelId: n.type === "new_order" ? "orders" : "default",
    priority: "high",
  }));
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(EXPO_TOKEN ? { Authorization: `Bearer ${EXPO_TOKEN}` } : {}),
    },
    body: JSON.stringify(messages),
  });
  const out = await res.json().catch(() => ({}));
  const tickets: Array<{ status: string; details?: { error?: string } }> = out?.data ?? [];
  const dead = tickets
    .map((t, i) => (t.status === "error" && t.details?.error === "DeviceNotRegistered" ? messages[i].to : null))
    .filter(Boolean) as string[];
  if (dead.length) await db.delete("push_tokens", `token=in.(${dead.map((t) => `"${encodeURIComponent(t)}"`).join(",")})`);
  await db.update("notifications", `id=eq.${n.id}`, { pushed_at: new Date().toISOString() });
  return json({ sent: messages.length, removed: dead.length });
});
