import { afterAll, describe, expect, it } from "vitest";
import { ANON, PASSWORD, URL, anonClient, callFn, makeAdmin, pool, signup, sql, uniquePhone } from "./helpers";

afterAll(() => pool.end());

describe("registration (phone + password, no OTP)", () => {
  it("validates input", async () => {
    await sql("delete from public.rate_limits where key like 'signup_ip:%'");
    expect((await callFn("auth-signup", { full_name: "A", phone: "50000000", password: PASSWORD, accept_terms: true })).body.error).toBe("FZ_INVALID_NAME");
    expect((await callFn("auth-signup", { full_name: "Ali", phone: "22223333", password: PASSWORD, accept_terms: true })).body.error).toBe("FZ_INVALID_PHONE");
    expect((await callFn("auth-signup", { full_name: "Ali", phone: uniquePhone(), password: "12345678", accept_terms: true })).body.error).toBe("FZ_WEAK_PASSWORD");
    expect((await callFn("auth-signup", { full_name: "Ali", phone: uniquePhone(), password: PASSWORD, accept_terms: false })).body.error).toBe("FZ_TERMS_REQUIRED");
  });

  it("creates the account, signs in directly, and keeps the phone UNVERIFIED", async () => {
    const u = await signup("Fatima Ali");
    const { data } = await u.client.from("profiles").select("*").single();
    expect(data.full_name).toBe("Fatima Ali");
    expect(data.phone).toBe(u.phone);
    expect(data.phone_verified).toBe(false);
    expect(data.active_mode).toBe("customer");
  });

  it("prevents duplicate phone numbers (also in other formats)", async () => {
    const u = await signup();
    const local = u.phone.replace("+965", "");
    await sql("delete from public.rate_limits where key like 'signup_ip:%'");
    const r = await callFn("auth-signup", { full_name: "Dup", phone: `+965 ${local.slice(0, 4)} ${local.slice(4)}`, password: PASSWORD, accept_terms: true });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("FZ_PHONE_TAKEN");
  });

  it("rate-limits signups per IP", async () => {
    await sql("delete from public.rate_limits where key like 'signup_ip:%'");
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      codes.push((await callFn("auth-signup", { full_name: "Spam", phone: "22223333", password: PASSWORD, accept_terms: true })).status);
    }
    // validation failures happen before the limiter; use a valid-but-taken flow instead
    const u = await signup();
    await sql("delete from public.rate_limits where key like 'signup_ip:%'");
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      statuses.push((await callFn("auth-signup", { full_name: "Spam", phone: u.phone, password: PASSWORD, accept_terms: true })).status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 409)).toBe(true);
    expect(statuses.slice(5).every((s) => s === 429)).toBe(true);
    expect(codes.length).toBe(7);
  });

  it("blocks direct sign-up and OTP on the Auth API", async () => {
    const res = await fetch(`${URL}/auth/v1/signup`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ phone: "96550009999", password: PASSWORD }) });
    expect(res.status).toBe(422);
    const otp = await fetch(`${URL}/auth/v1/otp`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ phone: "96550009999" }) });
    expect(otp.ok).toBe(false);
  });
});

describe("login", () => {
  it("logs in with phone + password in any format and logs out", async () => {
    const u = await signup();
    const local = u.phone.replace("+965", "");
    const r = await callFn("auth-login", { phone: `00965${local}`, password: PASSWORD });
    expect(r.status).toBe(200);
    expect(r.body.session.user.id).toBe(u.id);
    const c = anonClient();
    await c.auth.setSession({ access_token: r.body.session.access_token, refresh_token: r.body.session.refresh_token });
    expect((await c.from("profiles").select("id").single()).data?.id).toBe(u.id);
    await c.auth.signOut();
    const again = await c.auth.refreshSession({ refresh_token: r.body.session.refresh_token });
    expect(again.error).not.toBeNull();
  });

  it("rejects wrong passwords and locks the account after 5 failures", async () => {
    const u = await signup();
    for (let i = 0; i < 5; i++) {
      const r = await callFn("auth-login", { phone: u.phone, password: "WrongPass1" });
      expect(r.body.error).toBe("FZ_INVALID_CREDENTIALS");
    }
    const locked = await callFn("auth-login", { phone: u.phone, password: PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.body.error).toBe("FZ_LOGIN_LOCKED");
    // the lock is also enforced at the Auth server (password verification hook) for direct API calls
    const direct = await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ phone: u.phone.slice(1), password: PASSWORD }) });
    expect(direct.ok).toBe(false);
    await sql("delete from public.login_failures where phone = $1", [u.phone]);
    expect((await callFn("auth-login", { phone: u.phone, password: PASSWORD })).status).toBe(200);
  });

  it("does not reveal whether a phone exists", async () => {
    const r = await callFn("auth-login", { phone: uniquePhone(), password: PASSWORD });
    expect(r.body.error).toBe("FZ_INVALID_CREDENTIALS");
  });

  it("refuses suspended accounts and revokes their sessions", async () => {
    const admin = await makeAdmin("support");
    const u = await signup();
    const s = await admin.client.rpc("admin_set_user_status", { p_user: u.id, p_status: "suspended", p_reason: "test" });
    expect(s.error).toBeNull();
    const r = await callFn("auth-login", { phone: u.phone, password: PASSWORD });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("FZ_ACCOUNT_SUSPENDED");
    const rpc = await u.client.rpc("create_order", { p: {} });
    expect(rpc.error?.message).toMatch(/FZ_ACCOUNT_SUSPENDED|JWT|session/);
  });
});

describe("password recovery via support", () => {
  it("public request -> ticket -> staff issues temporary password -> must change", async () => {
    const u = await signup("Recover Me");
    const req = await callFn("public-request", { kind: "password_reset", phone: u.phone, full_name: "Recover Me", note: "forgot" });
    expect(req.body.received).toBe(true);
    const unknown = await callFn("public-request", { kind: "password_reset", phone: uniquePhone(), full_name: "Nobody" });
    expect(unknown.body.received).toBe(true); // same answer: no account enumeration
    const [ticket] = await sql("select * from public.tickets where contact_phone = $1 and kind = 'password_reset'", [u.phone]);
    expect(ticket.user_id).toBe(u.id);

    const notStaff = await signup();
    expect((await callFn("admin-reset-password", { user_id: u.id }, notStaff.token)).status).toBe(403);

    const admin = await makeAdmin("support");
    const r = await callFn("admin-reset-password", { user_id: u.id, ticket_id: ticket.id }, admin.token);
    expect(r.status).toBe(200);
    const temp = r.body.temp_password as string;
    expect(temp).toMatch(/^[A-Za-z0-9]{12}$/);
    expect((await callFn("auth-login", { phone: u.phone, password: PASSWORD })).status).toBe(401);
    const login = await callFn("auth-login", { phone: u.phone, password: temp });
    expect(login.status).toBe(200);
    const [p] = await sql("select must_change_password from public.profiles where id = $1", [u.id]);
    expect(p.must_change_password).toBe(true);
    const [t] = await sql("select status from public.tickets where id = $1", [ticket.id]);
    expect(t.status).toBe("resolved");
    const [a] = await sql("select * from public.audit_log where action = 'password_reset' and target_id = $1", [u.id]);
    expect(a.actor_id).toBe(admin.id);
  });
});
