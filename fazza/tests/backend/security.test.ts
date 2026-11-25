import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ANON, PASSWORD, URL, type TestUser, anonClient, callFn, code, completeOrder, createOrder, makeActiveDriver, makeAdmin,
  offer, pool, resetSettings, signup, sql, upload,
} from "./helpers";

let admin: TestUser;
beforeAll(async () => { await resetSettings(); admin = await makeAdmin(); });
afterAll(() => pool.end());

describe("row level security & privileges", () => {
  it("anonymous users only read public reference data", async () => {
    const a = anonClient();
    expect((await a.from("areas").select("id").limit(1)).data!.length).toBe(1);
    expect((await a.from("app_settings").select("commission_bps").single()).data!.commission_bps).toBe(1500);
    for (const t of ["profiles", "orders", "offers", "drivers", "ledger_entries", "payment_receipts", "messages", "audit_log", "admins", "rate_limits", "login_failures", "deleted_accounts"]) {
      const r = await a.from(t).select("*").limit(1);
      expect(r.error ?? r.data!.length === 0, t).toBeTruthy();
    }
    expect((await a.rpc("create_order", { p: {} })).error).not.toBeNull();
    expect((await a.rpc("admin_stats")).error).not.toBeNull();
    expect((await a.rpc("run_maintenance")).error).not.toBeNull();
    expect((await a.rpc("prepare_account_deletion", { p_user: admin.id })).error).not.toBeNull();
  });

  it("users can't read other users' data or escalate privileges", async () => {
    const u1 = await signup();
    const u2 = await signup();
    expect((await u1.client.from("profiles").select("*")).data!.map((p: any) => p.id)).toEqual([u1.id]);
    // protected columns are not updatable
    const esc = await u1.client.from("profiles").update({ phone_verified: true }).eq("id", u1.id);
    expect(esc.error).not.toBeNull();
    const esc2 = await u1.client.from("profiles").update({ status: "active", phone: "+96599999999" }).eq("id", u1.id);
    expect(esc2.error).not.toBeNull();
    const ok = await u1.client.from("profiles").update({ full_name: "New Name", locale: "en" }).eq("id", u1.id);
    expect(ok.error).toBeNull();
    const other = await u1.client.from("profiles").update({ full_name: "Hacked" }).eq("id", u2.id).select();
    expect(other.data ?? []).toEqual([]);
    expect((await u1.client.from("admins").insert({ user_id: u1.id, role: "owner" })).error).not.toBeNull();
    expect(code((await u1.client.rpc("admin_set_admin", { p_user: u1.id, p_role: "owner" })).error)).toBe("FZ_FORBIDDEN");
    expect(code((await u1.client.rpc("admin_update_settings", { p: { commission_bps: 0 } })).error)).toBe("FZ_FORBIDDEN");
    expect((await u1.client.from("app_settings").update({ commission_bps: 0 }).eq("id", 1)).error).not.toBeNull();
    expect((await u1.client.from("orders").insert({ id: randomUUID() })).error).not.toBeNull();
    expect((await u1.client.from("offers").update({ status: "accepted" }).neq("id", randomUUID())).error).not.toBeNull();
    expect((await u1.client.from("notifications").insert({ user_id: u2.id, type: "x", title_ar: "x", title_en: "x" })).error).not.toBeNull();
    expect((await u1.client.from("audit_log").select("*")).data).toEqual([]);
    // internal helpers are not callable by clients
    expect((await u1.client.rpc("finalize_order", { p_order: randomUUID(), p_actor: u1.id })).error).not.toBeNull();
    expect((await u1.client.rpc("notify_user", { p_user: u2.id, p_type: "x", p_title_ar: "x", p_title_en: "x" })).error).not.toBeNull();
    expect((await u1.client.rpc("hit_rate_limit", { p_key: "x", p_max: 1, p_window_seconds: 1 })).error).not.toBeNull();
    expect((await u1.client.rpc("login_record_success", { p_phone: u2.phone })).error).not.toBeNull();
  });

  it("orders, offers and chat are private to their participants", async () => {
    const c = await signup();
    const d = await makeActiveDriver(admin);
    const spy = await signup();
    const id = await createOrder(c);
    const of = await offer(d, id);
    await c.client.rpc("accept_offer", { p_offer: of.data });
    expect((await spy.client.from("orders").select("*").eq("id", id)).data).toEqual([]);
    expect((await spy.client.from("offers").select("*").eq("order_id", id)).data).toEqual([]);
    expect(code((await spy.client.rpc("get_order", { p_order: id })).error)).toBe("FZ_FORBIDDEN");
    expect(code((await spy.client.rpc("get_order_offers", { p_order: id })).error)).toBe("FZ_FORBIDDEN");
    expect(code((await spy.client.rpc("accept_offer", { p_offer: of.data })).error)).toBe("FZ_FORBIDDEN");
    expect(code((await spy.client.rpc("driver_update_status", { p_order: id, p_status: "picked_up", p_proof_path: null })).error)).toBe("FZ_FORBIDDEN");
    // chat images only by participants inside the order folder
    expect(await upload(spy.client, "order-files", `chat/${id}/${spy.id}/x.png`)).not.toBeNull();
    const img = `chat/${id}/${c.id}/${randomUUID()}.png`;
    expect(await upload(c.client, "order-files", img)).toBeNull();
    expect((await d.client.storage.from("order-files").download(img)).error).toBeNull();
    expect((await spy.client.storage.from("order-files").download(img)).error).not.toBeNull();
    // customer cannot write to another user's folder
    expect(await upload(c.client, "order-files", `orders/${d.id}/${randomUUID()}/x.png`)).not.toBeNull();
    expect(await upload(c.client, "receipts", `${d.id}/x.png`)).not.toBeNull();
    expect(await upload(c.client, "driver-docs", `${d.id}/x.png`)).not.toBeNull();
    // the customer can't offer on own order
    await completeOrder(c, d, id);
  });

  it("admin role boundaries", async () => {
    const support = await makeAdmin("support");
    const finance = await makeAdmin("finance");
    const u = await signup();
    expect(code((await finance.client.rpc("admin_set_user_status", { p_user: u.id, p_status: "suspended" })).error)).toBe("FZ_FORBIDDEN");
    expect((await support.client.rpc("admin_set_phone_verified", { p_user: u.id, p_verified: true })).error).toBeNull();
    const [p] = await sql("select phone_verified from public.profiles where id = $1", [u.id]);
    expect(p.phone_verified).toBe(true);
    expect(code((await support.client.rpc("admin_set_admin", { p_user: u.id, p_role: "admin" })).error)).toBe("FZ_FORBIDDEN");
    expect((await admin.client.rpc("admin_set_admin", { p_user: u.id, p_role: "support" })).error).toBeNull();
    expect(code((await support.client.rpc("admin_set_user_status", { p_user: admin.id, p_status: "suspended" })).error)).toBe("FZ_FORBIDDEN");
    expect((await support.client.from("audit_log").select("*").limit(1)).data).toEqual([]);
    expect((await admin.client.from("audit_log").select("*").limit(1)).data!.length).toBe(1);
    // audit log is append-only even for the database owner role used by the API
    await expect(sql("update public.audit_log set action = 'x' where id = (select min(id) from public.audit_log)")).rejects.toThrow(/FZ_APPEND_ONLY/);
    await expect(sql("delete from public.ledger_entries where id = (select min(id) from public.ledger_entries)")).rejects.toThrow(/FZ_APPEND_ONLY/);
  });

  it("support tickets and reports", async () => {
    const c = await signup();
    const d = await makeActiveDriver(admin);
    const id = await createOrder(c);
    const of = await offer(d, id);
    await c.client.rpc("accept_offer", { p_offer: of.data });
    await d.client.from("messages").insert({ order_id: id, sender_id: d.id, body: "rude message" });
    const { data: msg } = await c.client.from("messages").select("id").eq("order_id", id).single();
    const t = await c.client.rpc("create_ticket", { p_kind: "report_message", p_subject: "Abuse", p_body: "Rude", p_order: id, p_target_user: d.id, p_message: msg!.id });
    expect(t.error).toBeNull();
    const spy = await signup();
    expect(code((await spy.client.rpc("create_ticket", { p_kind: "complaint", p_subject: "x", p_body: "yy", p_order: id })).error)).toBe("FZ_FORBIDDEN");
    expect((await spy.client.from("tickets").select("*").eq("id", t.data)).data).toEqual([]);
    const support = await makeAdmin("support");
    expect((await support.client.rpc("admin_update_ticket", { p_ticket: t.data, p_status: "in_progress", p_reply: "We are on it" })).error).toBeNull();
    const { data: thread } = await c.client.from("ticket_messages").select("*").eq("ticket_id", t.data);
    expect(thread![0].from_staff).toBe(true);
    expect((await c.client.rpc("add_ticket_message", { p_ticket: t.data, p_body: "Thanks" })).error).toBeNull();
    // support can read the reported conversation
    expect((await support.client.from("messages").select("*").eq("id", msg!.id)).data!.length).toBe(1);
  });
});

describe("push dispatch webhook", () => {
  it("rejects calls without the shared secret and skips users without devices", async () => {
    const res = await fetch(`${URL}/functions/v1/push-dispatch`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ notification_id: 1 }) });
    expect(res.status).toBe(403);
    const bad = await fetch(`${URL}/functions/v1/push-dispatch`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json", "x-fazza-webhook-secret": "wrong" }, body: JSON.stringify({ notification_id: 1 }) });
    expect(bad.status).toBe(403);
    const u = await signup();
    await sql("select public.notify_user($1, 'test', 'ع', 'e', '', '', '{}'::jsonb)", [u.id]);
    const [n] = await sql("select id from public.notifications where user_id = $1", [u.id]);
    const ok = await fetch(`${URL}/functions/v1/push-dispatch`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json", "x-fazza-webhook-secret": "local-dev-push-secret" }, body: JSON.stringify({ notification_id: n.id }) });
    expect(ok.status).toBe(200);
    expect((await ok.json()).skipped).toBe(true);
    // a user can register a push token only for themselves
    expect((await u.client.rpc("register_push_token", { p_token: "ExponentPushToken[test-token-123]", p_platform: "ios" })).error).toBeNull();
    const { data: mine } = await u.client.from("push_tokens").select("token");
    expect(mine!.length).toBe(1);
  });
});

describe("account deletion", () => {
  it("requires the password, blocks while orders are active, deletes data and carries driver dues", async () => {
    const c = await signup();
    const d = await makeActiveDriver(admin);
    const id = await createOrder(c);
    const of = await offer(d, id, 10000);
    await c.client.rpc("accept_offer", { p_offer: of.data });
    expect((await callFn("delete-account", { password: "nope12345" }, d.token)).status).toBe(401);
    expect((await callFn("delete-account", { password: PASSWORD }, d.token)).body.error).toBe("FZ_ACTIVE_ORDERS");
    await completeOrder(c, d, id); // commission 1.500 KWD owed
    const r = await callFn("delete-account", { password: PASSWORD }, d.token);
    expect(r.status).toBe(200);
    expect((await sql("select 1 from auth.users where id = $1", [d.id])).length).toBe(0);
    expect((await sql("select 1 from public.profiles where id = $1", [d.id])).length).toBe(0);
    expect((await sql("select 1 from storage.objects where bucket_id = 'driver-docs' and name like $1", [`${d.id}/%`])).length).toBe(0);
    // financial history is kept (anonymised)
    expect((await sql("select driver_id from public.ledger_entries where order_id = $1", [id]))[0].driver_id).toBeNull();
    const [o] = await sql("select status, driver_id from public.orders where id = $1", [id]);
    expect(o).toEqual({ status: "completed", driver_id: null });
    // login no longer works
    expect((await callFn("auth-login", { phone: d.phone, password: PASSWORD })).status).toBe(401);
    // re-registering with the same phone carries the outstanding dues
    await sql("delete from public.rate_limits where key like 'signup_ip:%'");
    const again = await callFn("auth-signup", { full_name: "Back Again", phone: d.phone, password: PASSWORD, accept_terms: true });
    expect(again.status).toBe(201);
    const back: TestUser = { id: again.body.session.user.id, phone: d.phone, client: anonClient(), token: again.body.session.access_token };
    await back.client.auth.setSession({ access_token: again.body.session.access_token, refresh_token: again.body.session.refresh_token });
    const { registerDriver } = await import("./helpers");
    await registerDriver(back);
    const [drv] = await sql("select balance_fils::int from public.drivers where user_id = $1", [back.id]);
    expect(drv.balance_fils).toBe(1500);
  });

  it("customers can delete their account and their open orders are cancelled", async () => {
    const c = await signup();
    const id = await createOrder(c);
    expect((await callFn("delete-account", { password: PASSWORD }, c.token)).status).toBe(200);
    const [o] = await sql("select status from public.orders where id = $1", [id]);
    expect(o.status).toBe("cancelled");
    expect((await sql("select 1 from public.order_feed where order_id = $1", [id])).length).toBe(0);
  });

  it("public deletion request form creates a ticket", async () => {
    const r = await callFn("public-request", { kind: "account_deletion", phone: "50001111", full_name: "Web User" });
    expect(r.body.received).toBe(true);
    const res = await fetch(`${URL}/functions/v1/public-request`, { method: "GET", headers: { apikey: ANON } });
    expect(res.status).toBe(405);
  });
});
