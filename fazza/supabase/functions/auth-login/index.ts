// Phone + password login with account lockout (5 failures / 15 min per phone, 30 per IP).
import { db, passwordGrant, revokeAccessToken } from "../_shared/clients.ts";
import { clientIp, fail, handleOptions, json, readJson } from "../_shared/http.ts";
import { normalizeKwPhone } from "../_shared/validation.ts";

const HOOK_ENABLED = Deno.env.get("FAZZA_AUTH_HOOK_ENABLED") === "true";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  const body = await readJson<{ phone?: string; password?: string }>(req);
  const phone = normalizeKwPhone(body?.phone);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!phone || password.length < 1 || password.length > 72) return fail("FZ_INVALID_CREDENTIALS", 401);

  const ip = clientIp(req);
  const { data: ipHits } = await db.rpc<number>("hit_rate_limit", { p_key: `login_ip:${ip}`, p_max: 60, p_window_seconds: 900 });
  if ((ipHits ?? 0) > 60) return fail("FZ_RATE_LIMITED", 429);

  const { data: lock } = await db.rpc<{ locked: boolean; retry_after_seconds: number }>("login_lock_status", { p_phone: phone, p_ip: ip });
  if (lock?.locked) return fail("FZ_LOGIN_LOCKED", 429, { retry_after_seconds: lock.retry_after_seconds });

  const grant = await passwordGrant(phone, password);
  if (!grant.session) {
    if (grant.error?.includes("FZ_LOGIN_LOCKED")) return fail("FZ_LOGIN_LOCKED", 429, { retry_after_seconds: 900 });
    if (grant.status === 429) return fail("FZ_RATE_LIMITED", 429);
    if (!HOOK_ENABLED) await db.rpc("login_record_failure", { p_phone: phone, p_ip: ip });
    else await db.update("login_failures", `phone=eq.${encodeURIComponent(phone)}&ip=eq.auth-hook`, { ip });
    return fail("FZ_INVALID_CREDENTIALS", 401);
  }

  const { data: status } = await db.rpc<string>("account_status_by_phone", { p_phone: phone });
  if (status !== "active") {
    await revokeAccessToken(grant.session.access_token);
    return fail("FZ_ACCOUNT_SUSPENDED", 403);
  }
  await db.rpc("login_record_success", { p_phone: phone });
  return json({ session: grant.session });
});
