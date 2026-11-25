import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type TestUser, code, completeOrder, createOrder, makeActiveDriver, makeAdmin, offer, orderPayload, pool, proof,
  resetSettings, signup, sql, upload,
} from "./helpers";

let admin: TestUser;
beforeAll(async () => { await resetSettings(); admin = await makeAdmin(); });
afterAll(() => pool.end());

describe("order lifecycle", () => {
  it("customer creates order with photos; approved drivers see it without private data", async () => {
    const c = await signup("Customer");
    const id = randomUUID();
    const img = `orders/${c.id}/${id}/1.png`;
    expect(await upload(c.client, "order-files", img)).toBeNull();
    const { error } = await c.client.rpc("create_order", { p: orderPayload(id, { image_paths: [img] }) });
    expect(error).toBeNull();
    const d = await makeActiveDriver(admin);
    const { data: list, error: le } = await d.client.rpc("driver_open_orders", { p_lat: 29.37, p_lng: 47.98 });
    expect(le).toBeNull();
    const row = list.find((o: any) => o.id === id);
    expect(row).toBeTruthy();
    expect(row).not.toHaveProperty("recipient_phone");
    expect(row).not.toHaveProperty("dropoff_address");
    expect(row.distance_to_pickup_m).toBeGreaterThan(0);
    // driver can view the order photo to price it
    const dl = await d.client.storage.from("order-files").download(img);
    expect(dl.error).toBeNull();
    // driver cannot read the order row itself before acceptance
    const direct = await d.client.from("orders").select("*").eq("id", id);
    expect(direct.data).toEqual([]);
    // an unapproved user cannot list open orders
    const other = await signup();
    expect(code((await other.client.rpc("driver_open_orders", {})).error)).toBe("FZ_NOT_APPROVED_DRIVER");
  });

  it("is idempotent for offline retries with the same client id", async () => {
    const c = await signup();
    const id = randomUUID();
    const a = await c.client.rpc("create_order", { p: orderPayload(id) });
    const b = await c.client.rpc("create_order", { p: orderPayload(id) });
    expect(a.data).toBe(id);
    expect(b.data).toBe(id);
    const [{ count }] = await sql("select count(*)::int as count from public.orders where id = $1", [id]);
    expect(count).toBe(1);
    const hijack = await (await signup()).client.rpc("create_order", { p: orderPayload(id) });
    expect(code(hijack.error)).toBe("FZ_INVALID_ORDER");
  });

  it("rejects invalid data: locations outside Kuwait, foreign image paths, bad prices", async () => {
    const c = await signup();
    const out = await c.client.rpc("create_order", { p: orderPayload(randomUUID(), { pickup: { lat: 25.2, lng: 55.3, address: "Dubai" } }) });
    expect(out.error).not.toBeNull();
    const img = await c.client.rpc("create_order", { p: orderPayload(randomUUID(), { image_paths: ["orders/someone-else/x/1.png"] }) });
    expect(code(img.error)).toBe("FZ_INVALID_IMAGE_PATH");
    const id = await createOrder(c);
    const d = await makeActiveDriver(admin);
    expect(code((await offer(d, id, 100)).error)).toBe("FZ_INVALID_PRICE");
    expect(code((await offer(d, id, 1502)).error)).toBe("FZ_INVALID_PRICE"); // not a multiple of 5 fils
    expect(code((await offer(d, id, 1500, 0)).error)).toBe("FZ_INVALID_ETA");
    expect(code((await d.client.rpc("submit_offer", { p_order: id, p_price_fils: 1500, p_eta_minutes: 10 })).error)).toBeUndefined();
  });

  it("full flow: offers -> compare -> accept -> track -> chat -> deliver -> confirm -> rate", async () => {
    const c = await signup("Customer Flow");
    const d1 = await makeActiveDriver(admin, "Driver One");
    const d2 = await makeActiveDriver(admin, "Driver Two");
    const id = await createOrder(c);

    // the customer receives offers in realtime
    const received: any[] = [];
    const ch = c.client.channel(`offers-${id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "offers", filter: `order_id=eq.${id}` }, (p) => received.push(p.new))
    await new Promise<void>((resolve) => ch.subscribe((st) => st === "SUBSCRIBED" && resolve()));
    await new Promise((r) => setTimeout(r, 500));

    expect((await offer(d1, id, 2000, 25)).error).toBeNull();
    const o2 = await offer(d2, id, 1500, 15);
    expect(o2.error).toBeNull();
    // the driver can update the price (old offer withdrawn)
    const o2b = await offer(d2, id, 1250, 15);
    expect(o2b.error).toBeNull();
    for (let i = 0; i < 40 && received.length < 3; i++) await new Promise((r) => setTimeout(r, 250));
    expect(received.length).toBeGreaterThanOrEqual(3);
    await c.client.removeChannel(ch);

    const { data: offers } = await c.client.rpc("get_order_offers", { p_order: id });
    expect(offers.map((o: any) => o.price_fils).sort()).toEqual([1250, 2000]);
    expect(offers[0].driver_name).toBeTruthy();
    expect(offers[0]).not.toHaveProperty("phone");

    // driver cannot see competitors' offers
    const { data: seen } = await d1.client.from("offers").select("*").eq("order_id", id);
    expect(seen!.every((o: any) => o.driver_id === d1.id)).toBe(true);

    // location updates are refused while the driver has no active order
    expect((await d2.client.rpc("update_my_location", { p_lat: 29.36, p_lng: 47.99 })).data).toBe(false);

    const acc = await c.client.rpc("accept_offer", { p_offer: o2b.data });
    expect(acc.error).toBeNull();
    expect(acc.data.delivery_fee_fils).toBe(1250);
    const [order] = await sql("select * from public.orders where id = $1", [id]);
    expect(order.status).toBe("accepted");
    expect(order.driver_id).toBe(d2.id);
    const [{ status: s1 }] = await sql("select status from public.offers where order_id = $1 and driver_id = $2 and status <> 'withdrawn'", [id, d1.id]);
    expect(s1).toBe("rejected");
    expect((await sql("select 1 from public.order_feed where order_id = $1", [id])).length).toBe(0);

    // details are now visible to the assigned driver, including recipient phone
    const det = await d2.client.rpc("get_order", { p_order: id });
    expect(det.data.recipient_phone).toBe("+96560001234");
    expect(det.data.customer.full_name).toBe("Customer Flow");
    // ...but not to the losing driver
    expect(code((await d1.client.rpc("get_order", { p_order: id })).error)).toBe("FZ_FORBIDDEN");

    // live tracking
    expect((await d2.client.rpc("update_my_location", { p_lat: 29.36, p_lng: 47.99, p_heading: 90 })).data).toBe(true);
    const { data: loc } = await c.client.from("driver_locations").select("*").eq("driver_id", d2.id).single();
    expect(loc.lat).toBeCloseTo(29.36);
    const { data: locOther } = await d1.client.from("driver_locations").select("*").eq("driver_id", d2.id);
    expect(locOther).toEqual([]);

    // chat
    const m1 = await c.client.from("messages").insert({ order_id: id, sender_id: c.id, body: "Hello" });
    expect(m1.error).toBeNull();
    const m2 = await d2.client.from("messages").insert({ order_id: id, sender_id: d2.id, body: "On my way" });
    expect(m2.error).toBeNull();
    const spoof = await d2.client.from("messages").insert({ order_id: id, sender_id: c.id, body: "spoofed" });
    expect(spoof.error).not.toBeNull();
    const outsider = await d1.client.from("messages").insert({ order_id: id, sender_id: d1.id, body: "hi" });
    expect(outsider.error).not.toBeNull();
    const { data: msgs } = await c.client.from("messages").select("*").eq("order_id", id).order("created_at");
    expect(msgs!.map((m: any) => m.body)).toEqual(["Hello", "On my way"]);
    expect((await d1.client.from("messages").select("*").eq("order_id", id)).data).toEqual([]);

    // proof required
    expect(code((await d2.client.rpc("driver_update_status", { p_order: id, p_status: "picked_up", p_proof_path: null })).error)).toBe("FZ_PROOF_REQUIRED");
    // wrong order of transitions
    expect(code((await d2.client.rpc("driver_update_status", { p_order: id, p_status: "delivered", p_proof_path: await proof(d2, id) })).error)).toBe("FZ_INVALID_TRANSITION");
    // customer can't cancel after pickup
    await d2.client.rpc("driver_update_status", { p_order: id, p_status: "picked_up", p_proof_path: await proof(d2, id) });
    expect(code((await c.client.rpc("cancel_order", { p_order: id, p_reason: "x" })).error)).toBe("FZ_CANCEL_NOT_ALLOWED");
    await d2.client.rpc("driver_update_status", { p_order: id, p_status: "delivered", p_proof_path: await proof(d2, id) });
    // only the customer confirms
    expect(code((await d2.client.rpc("confirm_delivery", { p_order: id })).error)).toBe("FZ_FORBIDDEN");
    expect((await c.client.rpc("confirm_delivery", { p_order: id })).error).toBeNull();
    // location row removed after completion
    expect((await sql("select 1 from public.driver_locations where driver_id = $1", [d2.id])).length).toBe(0);
    expect((await sql("select 1 from public.messages where order_id = $1", [id])).length).toBe(2);

    // rating
    expect((await c.client.rpc("rate_order", { p_order: id, p_stars: 5, p_comment: "Fast" })).error).toBeNull();
    expect(code((await c.client.rpc("rate_order", { p_order: id, p_stars: 4 })).error)).toBe("FZ_ALREADY_RATED");
    expect((await d2.client.rpc("rate_order", { p_order: id, p_stars: 4 })).error).toBeNull();
    const dash = await d2.client.rpc("driver_dashboard");
    expect(dash.data.rating_avg).toBe(5);
    expect(dash.data.completed_count).toBe(1);
    expect(dash.data.today_earned_fils).toBe(1250);
    expect(dash.data.balance_fils).toBe(188); // 15% of 1.250 KWD, half-up

    // events timeline
    const { data: ev } = await c.client.from("order_events").select("to_status").eq("order_id", id).order("id");
    expect(ev!.map((e: any) => e.to_status)).toEqual(["open", "accepted", "picked_up", "delivered", "completed"]);

    // notifications were produced for both sides
    const { data: n } = await c.client.from("notifications").select("type");
    expect(n!.map((x: any) => x.type)).toEqual(expect.arrayContaining(["new_offer", "picked_up", "delivered", "message"]));
  });

  it("cancellation rules", async () => {
    const c = await signup();
    const d = await makeActiveDriver(admin);
    // open order: free cancellation
    const a = await createOrder(c);
    expect((await c.client.rpc("cancel_order", { p_order: a })).data).toBe("cancelled");
    // accepted: reason required, counted
    const b = await createOrder(c);
    const ob = await offer(d, b);
    await c.client.rpc("accept_offer", { p_offer: ob.data });
    expect(code((await c.client.rpc("cancel_order", { p_order: b })).error)).toBe("FZ_REASON_REQUIRED");
    expect((await c.client.rpc("cancel_order", { p_order: b, p_reason: "Changed my mind" })).data).toBe("cancelled");
    const [p] = await sql("select customer_cancellations from public.profiles where id = $1", [c.id]);
    expect(p.customer_cancellations).toBe(1);
    // driver cancels an accepted order -> back to the market
    const e = await createOrder(c);
    const oe = await offer(d, e);
    await c.client.rpc("accept_offer", { p_offer: oe.data });
    expect((await d.client.rpc("cancel_order", { p_order: e, p_reason: "Vehicle issue" })).data).toBe("open");
    const [order] = await sql("select status, driver_id from public.orders where id = $1", [e]);
    expect(order).toEqual({ status: "open", driver_id: null });
    expect((await sql("select 1 from public.order_feed where order_id = $1", [e])).length).toBe(1);
    // a stranger cannot cancel
    expect(code((await (await signup()).client.rpc("cancel_order", { p_order: e, p_reason: "x" })).error)).toBe("FZ_FORBIDDEN");
  });

  it("expires stale orders and offers via the scheduled maintenance job", async () => {
    const c = await signup();
    const id = await createOrder(c);
    await sql("update public.orders set expires_at = now() - interval '1 minute' where id = $1", [id]);
    await sql("select public.run_maintenance()");
    const [o] = await sql("select status from public.orders where id = $1", [id]);
    expect(o.status).toBe("expired");
  });

  it("auto-completes delivered orders after the configured hours and charges commission once", async () => {
    const c = await signup();
    const d = await makeActiveDriver(admin);
    const id = await createOrder(c);
    const of = await offer(d, id, 3000);
    await c.client.rpc("accept_offer", { p_offer: of.data });
    await d.client.rpc("driver_update_status", { p_order: id, p_status: "picked_up", p_proof_path: await proof(d, id) });
    await d.client.rpc("driver_update_status", { p_order: id, p_status: "delivered", p_proof_path: await proof(d, id) });
    await sql("update public.orders set delivered_at = now() - interval '25 hours' where id = $1", [id]);
    await sql("select public.run_maintenance()");
    await sql("select public.run_maintenance()");
    const [o] = await sql("select status, commission_fils from public.orders where id = $1", [id]);
    expect(o).toEqual({ status: "completed", commission_fils: 450 });
    const [{ n }] = await sql("select count(*)::int n from public.ledger_entries where order_id = $1 and kind = 'commission'", [id]);
    expect(n).toBe(1);
    // confirming again cannot charge twice
    expect(code((await c.client.rpc("confirm_delivery", { p_order: id })).error)).toBe("FZ_INVALID_TRANSITION");
  });

  it("completeOrder helper path works for multiple orders per driver up to the active limit", async () => {
    const c = await signup();
    const d = await makeActiveDriver(admin);
    const ids = [await createOrder(c), await createOrder(c), await createOrder(c), await createOrder(c)];
    for (const id of ids.slice(0, 3)) {
      const of = await offer(d, id);
      expect((await c.client.rpc("accept_offer", { p_offer: of.data })).error).toBeNull();
    }
    expect(code((await offer(d, ids[3])).error)).toBe("FZ_TOO_MANY_ACTIVE");
    await completeOrder(c, d, ids[0]);
    expect((await offer(d, ids[3])).error).toBeNull();
  });
});
