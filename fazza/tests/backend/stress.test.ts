import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TestUser, createOrder, makeActiveDriver, makeAdmin, offer, orderPayload, pool, resetSettings, signup, sql } from "./helpers";

let admin: TestUser;
let drivers: TestUser[] = [];
async function signupMany(n: number) { const out: TestUser[] = []; for (let i = 0; i < n; i++) out.push(await signup()); return out; }
beforeAll(async () => {
  await resetSettings();
  admin = await makeAdmin();
  for (let i = 0; i < 12; i++) drivers.push(await makeActiveDriver(admin, `Stress Driver ${i}`));
}, 120_000);
afterAll(() => pool.end());

describe("concurrency & load", () => {
  it("only ONE of many simultaneous accept calls on the same order succeeds", async () => {
    const c = await signup();
    const id = await createOrder(c);
    const offers = await Promise.all(drivers.map((d, i) => offer(d, id, 1000 + i * 5)));
    expect(offers.every((o) => o.error === null)).toBe(true);
    const results = await Promise.all(offers.map((o) => c.client.rpc("accept_offer", { p_offer: o.data })));
    const ok = results.filter((r) => r.error === null);
    expect(ok.length).toBe(1);
    expect(results.filter((r) => r.error).every((r) => /FZ_ORDER_NOT_OPEN|FZ_OFFER_NOT_PENDING/.test(r.error!.message))).toBe(true);
    const [{ n }] = await sql("select count(*)::int n from public.offers where order_id = $1 and status = 'accepted'", [id]);
    expect(n).toBe(1);
  });

  it("a driver can't exceed the active-order limit through parallel acceptances", async () => {
    const d = drivers[0];
    const customers = await signupMany(6);
    const ids = await Promise.all(customers.map((c) => createOrder(c)));
    // free the driver from the previous test's accepted order
    await sql("update public.orders set status = 'cancelled' where driver_id = $1 and status in ('accepted','picked_up','delivered')", [d.id]);
    const offs = await Promise.all(ids.map((id) => offer(d, id)));
    expect(offs.every((o) => !o.error)).toBe(true);
    const res = await Promise.all(customers.map((c, i) => c.client.rpc("accept_offer", { p_offer: offs[i].data })));
    expect(res.filter((r) => !r.error).length).toBe(3); // max_active_orders_per_driver
    const [{ n }] = await sql("select count(*)::int n from public.orders where driver_id = $1 and status = 'accepted'", [d.id]);
    expect(n).toBe(3);
  });

  it("concurrent retries of the same offline order create exactly one order", async () => {
    const c = await signup();
    const id = randomUUID();
    const res = await Promise.all(Array.from({ length: 8 }, () => c.client.rpc("create_order", { p: orderPayload(id) })));
    expect(res.filter((r) => r.data === id).length).toBeGreaterThanOrEqual(1);
    const [{ n }] = await sql("select count(*)::int n from public.orders where id = $1", [id]);
    expect(n).toBe(1);
  });

  it("handles a burst of 40 orders and 200 offers in parallel", async () => {
    const customers = await signupMany(8);
    const t0 = Date.now();
    const ids = (await Promise.all(customers.map(async (c) => Promise.all(Array.from({ length: 5 }, () => createOrder(c)))))).flat();
    const tOrders = Date.now() - t0;
    const pending = drivers.slice(1);
    const t1 = Date.now();
    const results = await Promise.all(ids.flatMap((id) => pending.slice(0, 5).map((d) => offer(d, id, 1500))));
    const tOffers = Date.now() - t1;
    const failed = results.filter((r) => r.error);
    expect(failed.map((f) => f.error!.message).filter((m) => !/FZ_RATE_LIMITED/.test(m))).toEqual([]);
    console.log(`40 orders in ${tOrders} ms; ${results.length} offers in ${tOffers} ms; rate-limited: ${failed.length}`);
    expect(tOffers).toBeLessThan(30_000);
  });

  it("rate limits abusive offer spam per driver", async () => {
    const d = drivers[11];
    const c = await signup();
    const ids = await Promise.all(Array.from({ length: 5 }, () => createOrder(c)));
    let limited = 0;
    for (let i = 0; i < 50; i++) {
      const r = await offer(d, ids[i % 5], 1000 + (i % 10) * 5);
      if (r.error?.message.includes("FZ_RATE_LIMITED")) limited++;
    }
    expect(limited).toBeGreaterThan(0);
  });
});
