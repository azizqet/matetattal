// Unauthenticated requests: password recovery via support, and account deletion requests
// from the public web form (required by Google Play). Always answers the same way (no account enumeration).
import { db } from "../_shared/clients.ts";
import { clientIp, fail, handleOptions, json, readJson } from "../_shared/http.ts";
import { cleanName, normalizeKwPhone } from "../_shared/validation.ts";

interface Body { kind?: string; phone?: string; full_name?: string; note?: string }

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  const body = await readJson<Body>(req);
  if (!body || !["password_reset", "account_deletion"].includes(body.kind ?? "")) return fail("FZ_BAD_REQUEST");
  const phone = normalizeKwPhone(body.phone);
  const name = cleanName(body.full_name);
  if (!phone) return fail("FZ_INVALID_PHONE");
  if (!name) return fail("FZ_INVALID_NAME");
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";

  const ip = clientIp(req);
  const { data: ipHits } = await db.rpc<number>("hit_rate_limit", { p_key: `public_req_ip:${ip}`, p_max: 5, p_window_seconds: 3600 });
  const { data: phoneHits } = await db.rpc<number>("hit_rate_limit", { p_key: `public_req_phone:${phone}`, p_max: 3, p_window_seconds: 86400 });
  if ((ipHits ?? 0) > 5 || (phoneHits ?? 0) > 3) return fail("FZ_RATE_LIMITED", 429);

  const { data: rows } = await db.select<{ id: string }>("profiles", `select=id&phone=eq.${encodeURIComponent(phone)}`);
  const profile = rows?.[0];
  const subject = body.kind === "password_reset" ? "Password reset request" : "Account deletion request";
  await db.insert("tickets", {
    kind: body.kind,
    user_id: profile?.id ?? null,
    contact_phone: phone,
    contact_name: name,
    subject,
    body: note || subject,
  });
  return json({ received: true });
});
