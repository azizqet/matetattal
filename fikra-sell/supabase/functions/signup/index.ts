// FIKRA SELL · Edge Function "signup"
// Instant e-mail sign-up: creates the account already confirmed (no confirmation
// e-mail, no OTP); the app then signs in with the same password immediately.
// The e-mail is treated as unverified everywhere else in the product.
// Abuse controls: per-IP limits (public.signup_guard), disposable-domain block and
// global circuit breaker (handle_new_user trigger), password policy below.
import { createClient } from "npm:@supabase/supabase-js@2.119.2";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ code: "method_not_allowed" }, 405);

  let body: { name?: string; email?: string; password?: string; locale?: string };
  try { body = await req.json(); } catch { return json({ code: "bad_request" }, 400); }
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const locale = body.locale === "en" ? "en" : "ar";

  if (name.length < 2 || name.length > 60) return json({ code: "invalid_name" }, 400);
  if (!EMAIL_RE.test(email) || email.length > 254) return json({ code: "invalid_email" }, 400);
  if (password.length < 8 || password.length > 72 || !/\d/.test(password) || !/[A-Za-z؀-ۿ]/.test(password)) {
    return json({ code: "weak_password" }, 400);
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim();
  const guard = await db.rpc("signup_guard", { p_ip: ip });
  if (guard.error) return json({ code: "signup_rate_limited" }, 429);

  const { error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, locale },
  });
  if (error) {
    const msg = `${error.message ?? ""} ${(error as { code?: string }).code ?? ""}`;
    if (/already|exists|registered/i.test(msg)) return json({ code: "email_exists" }, 409);
    if (/disposable_email/i.test(msg)) return json({ code: "disposable_email" }, 400);
    if (/signup_rate_limited/i.test(msg)) return json({ code: "signup_rate_limited" }, 429);
    console.error("createUser failed", msg);
    return json({ code: "signup_failed" }, 500);
  }
  return json({ ok: true });
});
