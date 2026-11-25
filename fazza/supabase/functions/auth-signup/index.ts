// Registration with Kuwaiti phone + password. No OTP / SMS / e-mail is used.
// The phone is stored as NOT verified (profiles.phone_verified = false) until staff verify it.
import { authAdmin, db, passwordGrant } from "../_shared/clients.ts";
import { clientIp, fail, handleOptions, json, readJson } from "../_shared/http.ts";
import { cleanName, normalizeKwPhone, passwordProblem } from "../_shared/validation.ts";

interface Body { full_name?: string; phone?: string; password?: string; locale?: string; accept_terms?: boolean }

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  const body = await readJson<Body>(req);
  if (!body) return fail("FZ_BAD_REQUEST");

  const name = cleanName(body.full_name);
  const phone = normalizeKwPhone(body.phone);
  if (!name) return fail("FZ_INVALID_NAME");
  if (!phone) return fail("FZ_INVALID_PHONE");
  const pw = passwordProblem(body.password);
  if (pw) return fail(pw);
  if (body.accept_terms !== true) return fail("FZ_TERMS_REQUIRED");
  const locale = body.locale === "en" ? "en" : "ar";

  const ip = clientIp(req);
  const { data: ipHits } = await db.rpc<number>("hit_rate_limit", { p_key: `signup_ip:${ip}`, p_max: 5, p_window_seconds: 3600 });
  if ((ipHits ?? 0) > 5) return fail("FZ_RATE_LIMITED", 429);

  const { data: exists, error: existsErr } = await db.rpc<boolean>("phone_exists", { p_phone: phone });
  if (existsErr) return fail("FZ_SERVER_ERROR", 500);
  if (exists) return fail("FZ_PHONE_TAKEN", 409);

  // phone_confirm is required by Supabase Auth to allow password sign-in without an OTP step.
  // It does NOT mean the number was verified: FAZZA tracks that separately in profiles.phone_verified.
  const { data: created, error } = await authAdmin.createUser({
    phone: phone.slice(1),
    password: body.password!,
    phone_confirm: true,
    user_metadata: { full_name: name, locale },
  });
  if (error || !created?.id) {
    const msg = (error?.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("exists") || msg.includes("duplicate")) return fail("FZ_PHONE_TAKEN", 409);
    console.error("createUser failed", error?.message);
    return fail("FZ_SERVER_ERROR", 500);
  }

  const grant = await passwordGrant(phone, body.password!);
  if (!grant.session) return json({ created: true, session: null }, 201);
  return json({ created: true, session: grant.session }, 201);
});
