import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type TestUser, code, completeOrder, createOrder, makeActiveDriver, makeAdmin, offer, pool, registerDriver,
  resetSettings, signup, sql, upload,
} from "./helpers";

let admin: TestUser;
beforeAll(async () => { await resetSettings(); admin = await makeAdmin(); });
afterAll(async () => { await resetSettings(); await pool.end(); });

async function receipt(d: TestUser, purpose: "activation_fee" | "commission", amount: number) {
  const path = `${d.id}/${randomUUID()}.png`;
  expect(await upload(d.client, "receipts", path)).toBeNull();
  return d.client.rpc("submit_receipt", { p_purpose: purpose, p_amount_fils: amount, p_image_path: path, p_reference: "KNET-1" });
}

describe("driver onboarding & activation fee", () => {
  it("a new driver can't receive orders before review, approval and activation payment", async () => {
    const d = await signup("New Driver");
    expect(code((await d.client.rpc("set_online", { p_online: true })).error)).toBe("FZ_NOT_DRIVER");
    // missing documents
    const bad = await d.client.rpc("register_driver", { p_vehicle_type: "car", p_vehicle_model: "", p_plate: "12345", p_documents: [] });
    expect(code(bad.error)).toBe("FZ_MISSING_DOCUMENTS");
    // documents in another user's folder are rejected
    const foreign = await d.client.rpc("register_driver", { p_vehicle_type: "car", p_vehicle_model: "", p_plate: "12345",
      p_documents: ["photo", "civil_id_front", "civil_id_back", "driving_license", "vehicle_registration"].map((k) => ({ kind: k, path: `${admin.id}/${k}.png` })) });
    expect(code(foreign.error)).toBe("FZ_INVALID_DOCUMENT_PATH");
    expect(await registerDriver(d)).toBe("pending");
    expect(code((await d.client.rpc("set_online", { p_online: true })).error)).toBe("FZ_CANNOT_RECEIVE:pending_review");

    // reviewer can open the private documents; other users can't
    const [doc] = await sql("select storage_path from public.driver_documents where driver_id = $1 limit 1", [d.id]);
    expect((await admin.client.storage.from("driver-docs").createSignedUrl(doc.storage_path, 60)).error).toBeNull();
    const stranger = await signup();
    expect((await stranger.client.storage.from("driver-docs").download(doc.storage_path)).error).not.toBeNull();
    expect((await stranger.client.storage.from("driver-docs").createSignedUrl(doc.storage_path, 60)).error).not.toBeNull();

    // finance staff cannot approve drivers; support/admin can
    const finance = await makeAdmin("finance");
    expect(code((await finance.client.rpc("admin_review_driver", { p_driver: d.id, p_decision: "approve" })).error)).toBe("FZ_FORBIDDEN");
    expect(code((await admin.client.rpc("admin_review_driver", { p_driver: d.id, p_decision: "reject" })).error)).toBe("FZ_REASON_REQUIRED");
    expect((await admin.client.rpc("admin_review_driver", { p_driver: d.id, p_decision: "approve" })).data).toBe("approved");
    expect(code((await d.client.rpc("set_online", { p_online: true })).error)).toBe("FZ_CANNOT_RECEIVE:activation_unpaid");

    // uploading a receipt does NOT activate automatically
    const r = await receipt(d, "activation_fee", 5000);
    expect(r.error).toBeNull();
    expect(code((await d.client.rpc("set_online", { p_online: true })).error)).toBe("FZ_CANNOT_RECEIVE:activation_unpaid");
    const support = await makeAdmin("support");
    expect(code((await support.client.rpc("admin_review_receipt", { p_receipt: r.data, p_decision: "approve" })).error)).toBe("FZ_FORBIDDEN");
    expect((await finance.client.rpc("admin_review_receipt", { p_receipt: r.data, p_decision: "approve" })).data).toBe("approved");
    expect(code((await finance.client.rpc("admin_review_receipt", { p_receipt: r.data, p_decision: "approve" })).error)).toBe("FZ_ALREADY_REVIEWED");
    expect((await d.client.rpc("set_online", { p_online: true })).error).toBeNull();
    expect(code((await receipt(d, "activation_fee", 5000)).error)).toBe("FZ_ALREADY_ACTIVATED");
    const [log] = await sql("select * from public.audit_log where action = 'receipt_approved' and target_id = $1", [r.data]);
    expect(log.actor_id).toBe(finance.id);
  });

  it("activation discount promo code (100% => activated, single use)", async () => {
    const promo = `FREE${Math.floor(Math.random() * 1e6)}`;
    const p = await admin.client.rpc("admin_upsert_promo", { p: { code: promo, kind: "activation_discount", percent_off: 100, max_redemptions: 1 } });
    expect(p.error).toBeNull();
    const d = await signup();
    await registerDriver(d);
    await admin.client.rpc("admin_review_driver", { p_driver: d.id, p_decision: "approve" });
    const r = await d.client.rpc("redeem_promo", { p_code: promo.toLowerCase() });
    expect(r.data.activation_fee_due_fils).toBe(0);
    expect((await d.client.rpc("set_online", { p_online: true })).error).toBeNull();
    const d2 = await signup();
    await registerDriver(d2);
    expect(code((await d2.client.rpc("redeem_promo", { p_code: promo })).error)).toBe("FZ_PROMO_INVALID"); // max reached
  });
});

describe("commission, debt limit and payments", () => {
  it("charges exactly 15% of the delivery fee (not purchases) on completed orders only, in fils", async () => {
    const c = await signup();
    const d = await makeActiveDriver(admin);
    // 1.250 KWD fee + 12.000 KWD purchase estimate -> commission 188 fils
    const id = await createOrder(c, { purchase_estimate_fils: 12000 });
    const of = await offer(d, id, 1250);
    await c.client.rpc("accept_offer", { p_offer: of.data });
    // cancelled orders are never commissioned
    const cancelled = await createOrder(c);
    const oc = await offer(d, cancelled, 4000);
    await c.client.rpc("accept_offer", { p_offer: oc.data });
    await c.client.rpc("cancel_order", { p_order: cancelled, p_reason: "test" });
    await completeOrder(c, d, id);
    const rows = await sql("select kind, amount_fils::int, order_id from public.ledger_entries where driver_id = $1", [d.id]);
    expect(rows).toEqual([{ kind: "commission", amount_fils: 188, order_id: id }]);
    const [o] = await sql("select commission_fils, delivery_fee_fils, purchase_estimate_fils from public.orders where id = $1", [id]);
    expect(o).toEqual({ commission_fils: 188, delivery_fee_fils: 1250, purchase_estimate_fils: 12000 });
    // a direct duplicate insert is blocked by the unique index
    await expect(sql("insert into public.ledger_entries (driver_id, kind, amount_fils, order_id) values ($1, 'commission', 188, $2)", [d.id, id])).rejects.toThrow(/duplicate/);
  });

  it("pauses new orders at 5 KWD unpaid, lets accepted orders finish, resumes after approved payment", async () => {
    const c = await signup();
    const d = await makeActiveDriver(admin);
    // two orders accepted first; fees 20 KWD => commission 3 KWD each
    const a = await createOrder(c);
    const b = await createOrder(c);
    for (const id of [a, b]) {
      const of = await offer(d, id, 20000);
      expect((await c.client.rpc("accept_offer", { p_offer: of.data })).error).toBeNull();
    }
    await completeOrder(c, d, a); // balance 3.000
    const pending = await createOrder(c);
    const pendingOffer = await offer(d, pending, 1000);
    expect(pendingOffer.error).toBeNull();
    await completeOrder(c, d, b); // balance 6.000 >= 5.000 -> blocked; the already-accepted order b could still be completed
    let dash = (await d.client.rpc("driver_dashboard")).data;
    expect(dash.balance_fils).toBe(6000);
    expect(dash.can_receive).toBe(false);
    expect(dash.block_reason).toBe("debt_limit");
    expect(dash.is_online).toBe(false);
    const fresh = await createOrder(c);
    expect(code((await offer(d, fresh, 1000)).error)).toBe("FZ_CANNOT_RECEIVE:debt_limit");
    // an older pending offer can't be accepted while blocked
    expect(code((await c.client.rpc("accept_offer", { p_offer: pendingOffer.data })).error)).toBe("FZ_DRIVER_UNAVAILABLE");

    // the driver cannot tamper with balances
    const tamper = await d.client.from("drivers").update({ balance_fils: 0 }).eq("user_id", d.id).select();
    expect(tamper.data ?? []).toEqual([]);
    const ins = await d.client.from("ledger_entries").insert({ driver_id: d.id, kind: "payment", amount_fils: -6000 });
    expect(ins.error).not.toBeNull();

    // receipt for 4.000 -> still blocked (2.000 < 5.000 => unblocked actually); pay 1.000 first -> 5.000 still blocked
    const r1 = await receipt(d, "commission", 1000);
    const finance = await makeAdmin("finance");
    expect(code((await finance.client.rpc("admin_review_receipt", { p_receipt: r1.data, p_decision: "reject" })).error)).toBe("FZ_REASON_REQUIRED");
    await finance.client.rpc("admin_review_receipt", { p_receipt: r1.data, p_decision: "approve" });
    dash = (await d.client.rpc("driver_dashboard")).data;
    expect(dash.balance_fils).toBe(5000);
    expect(dash.can_receive).toBe(false); // reaching the limit (>=) still blocks
    // admin may approve a different amount than declared (e.g. after checking the bank transfer)
    const r2 = await receipt(d, "commission", 5000);
    await finance.client.rpc("admin_review_receipt", { p_receipt: r2.data, p_decision: "approve", p_approved_amount_fils: 4500, p_note: "partial" });
    dash = (await d.client.rpc("driver_dashboard")).data;
    expect(dash.balance_fils).toBe(500);
    expect(dash.can_receive).toBe(true);
    expect(dash.paid_total_fils).toBe(5500);
    expect((await d.client.rpc("set_online", { p_online: true })).error).toBeNull();
    expect((await offer(d, fresh, 1000)).error).toBeNull();
    // rejected receipt
    const r3 = await receipt(d, "commission", 500);
    await finance.client.rpc("admin_review_receipt", { p_receipt: r3.data, p_decision: "reject", p_note: "unreadable" });
    expect((await d.client.rpc("driver_dashboard")).data.balance_fils).toBe(500);
  });

  it("settings are editable at runtime by admins only and apply to new orders", async () => {
    const c = await signup();
    const d = await makeActiveDriver(admin);
    const finance = await makeAdmin("finance");
    expect(code((await finance.client.rpc("admin_update_settings", { p: { commission_bps: 1000 } })).error)).toBe("FZ_FORBIDDEN");
    expect(code((await admin.client.rpc("admin_update_settings", { p: { balance: 1 } })).error)).toMatch(/FZ_INVALID_SETTING/);
    expect((await admin.client.rpc("admin_update_settings", { p: { commission_bps: 1000, support_phone: "+96550000000" } })).error).toBeNull();
    const id = await createOrder(c);
    const of = await offer(d, id, 2000);
    await c.client.rpc("accept_offer", { p_offer: of.data });
    // a settings change after acceptance does not affect this order
    await admin.client.rpc("admin_update_settings", { p: { commission_bps: 2000 } });
    await completeOrder(c, d, id);
    const [o] = await sql("select commission_fils from public.orders where id = $1", [id]);
    expect(o.commission_fils).toBe(200);
    const { data: s } = await (await signup()).client.from("app_settings").select("support_phone").single();
    expect(s!.support_phone).toBe("+96550000000");
    await resetSettings();
  });

  it("financial report and stats aggregate in fils", async () => {
    const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10); // Asia/Kuwait
    const { data, error } = await admin.client.rpc("admin_financial_report", { p_from: today, p_to: today });
    expect(error).toBeNull();
    expect(data[0].commission_fils).toBeGreaterThan(0);
    expect(Number.isInteger(data[0].gross_fees_fils)).toBe(true);
    const stats = await admin.client.rpc("admin_stats");
    expect(stats.data.commission_today_fils).toBe(data[0].commission_fils);
    const normal = await signup();
    expect(code((await normal.client.rpc("admin_stats")).error)).toBe("FZ_FORBIDDEN");
    expect(code((await normal.client.rpc("admin_financial_report", { p_from: today, p_to: today })).error)).toBe("FZ_FORBIDDEN");
  });
});
