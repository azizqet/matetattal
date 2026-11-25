// FIKRA SELL · Edge Function "push"
// Called by the database (pg_net) after a notification row is inserted.
// Sends it to the recipient's devices through the Expo Push API, honouring
// the user's notification preferences, and prunes invalid tokens.
//
// The caller must send x-push-secret; it is checked against private.config
// through the service-role-only RPC verify_push_secret (migration 0013).
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { createClient } from "npm:@supabase/supabase-js@2.119.2";

const PREF_BY_TYPE: Record<string, string> = {
  message: "messages",
  ad_approved: "ads",
  ad_rejected: "ads",
  ad_expired: "ads",
  ad_expiring: "ads",
  saved_search: "saved_searches",
  offer: "offers",
  general: "general",
  support: "general",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const provided = req.headers.get("x-push-secret") ?? "";
  const { data: ok } = provided ? await db.rpc("verify_push_secret", { p_secret: provided }) : { data: false };
  if (ok !== true) return new Response("unauthorized", { status: 401 });

  let id: number;
  try {
    ({ notification_id: id } = await req.json());
    if (!Number.isInteger(id)) throw new Error();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const { data: n } = await db.from("notifications").select("*").eq("id", id).single();
  if (!n || n.pushed_at) return Response.json({ skipped: true });

  const { data: settings } = await db
    .from("profile_settings").select("locale, notification_prefs").eq("user_id", n.user_id).single();
  const pref = PREF_BY_TYPE[n.type] ?? "general";
  if (settings?.notification_prefs && settings.notification_prefs[pref] === false) {
    await db.from("notifications").update({ pushed_at: new Date().toISOString() }).eq("id", id);
    return Response.json({ skipped: "preference" });
  }

  const { data: tokens } = await db.from("push_tokens").select("token").eq("user_id", n.user_id);
  if (!tokens?.length) return Response.json({ skipped: "no_tokens" });

  const en = settings?.locale === "en";
  const { count: badge } = await db
    .from("notifications").select("id", { count: "exact", head: true })
    .eq("user_id", n.user_id).is("read_at", null);

  const messages = tokens.map(({ token }) => ({
    to: token,
    title: en ? n.title_en : n.title_ar,
    body: en ? n.body_en : n.body_ar,
    data: { ...n.data, notification_id: n.id, type: n.type },
    sound: "default",
    badge: badge ?? undefined,
    channelId: n.type === "message" ? "messages" : "default",
    priority: "high",
  }));

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(messages),
  });
  const out = await res.json().catch(() => ({}));

  // Remove tokens Expo reports as no longer registered.
  const dead: string[] = [];
  (out?.data ?? []).forEach((r: { status: string; details?: { error?: string } }, i: number) => {
    if (r.status === "error" && r.details?.error === "DeviceNotRegistered") dead.push(messages[i].to);
  });
  if (dead.length) await db.from("push_tokens").delete().in("token", dead);

  await db.from("notifications").update({ pushed_at: new Date().toISOString() }).eq("id", id);
  return Response.json({ sent: messages.length, removed: dead.length });
});
