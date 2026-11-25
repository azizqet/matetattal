/**
 * End-to-end: the real app UI (react-native-web build) against the real local Supabase stack.
 * Customer registers in the UI, creates an order, receives a live offer from a driver,
 * accepts it, follows status changes in real time, confirms receipt and rates the driver.
 */
import { mkdirSync } from "node:fs";
import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright";
import { type TestUser, makeActiveDriver, makeAdmin, pool, proof, resetSettings, sql, uniquePhone } from "../backend/helpers";
import { ROOT, chromium, serve } from "./support";

const PORT = 8091;
const SHOTS = process.env.STORE_SHOTS ? `${ROOT}/store/raw` : `${ROOT}/docs/test-report/screens`;
let server: Server;
let browser: Browser;
let page: Page;
let admin: TestUser;
const phone = uniquePhone();

async function shot(name: string) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true });
  await resetSettings();
  await sql("delete from public.rate_limits where key like 'signup_ip:%'");
  admin = await makeAdmin();
  server = await serve(`${ROOT}/apps/mobile/dist-web`, PORT);
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: process.env.STORE_SHOTS ? { width: 430, height: 932 } : { width: 393, height: 852 }, deviceScaleFactor: process.env.STORE_SHOTS ? 3 : 1, locale: "ar-KW", hasTouch: true });
  page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  page.on("pageerror", (e) => console.error("PAGE ERROR", e.message));
  page.on("console", (m) => m.type() === "error" && console.error("CONSOLE", m.text().slice(0, 300)));
}, 120_000);

afterEach(async (ctx) => {
  await page.context().setOffline(false);
  if (ctx.task.result?.state === "fail") await page.screenshot({ path: `${SHOTS}/FAILED-${ctx.task.name.slice(0, 20)}.png` });
});

afterAll(async () => {
  await browser?.close();
  server?.close();
  await pool.end();
});

describe("customer journey in the app UI", () => {
  it("onboarding -> register -> home", async () => {
    await page.goto(`http://127.0.0.1:${PORT}/`);
    await page.getByTestId("onboarding-next").waitFor({ timeout: 30_000 });
    await shot("01-onboarding");
    for (let i = 0; i < 3; i++) await page.getByTestId("onboarding-next").click();
    await page.getByTestId("go-register").waitFor();
    await shot("02-welcome");
    await page.getByTestId("go-register").click();
    await page.getByTestId("reg-name").fill("مريم الكويتية");
    await page.getByTestId("reg-phone").fill(phone);
    await page.getByTestId("reg-password").fill("Fazza2026pass");
    await page.getByTestId("reg-password2").fill("Fazza2026pass");
    await page.getByTestId("reg-terms").click();
    await shot("03-register");
    await page.getByTestId("reg-submit").click();
    await page.getByTestId("new-order").waitFor({ timeout: 30_000 });
    await shot("04-home");
    const [p] = await sql("select full_name, phone_verified from public.profiles where phone = $1", [`+965${phone}`]);
    expect(p).toEqual({ full_name: "مريم الكويتية", phone_verified: false });
  });

  it("creates an order with pickup/drop-off chosen from the Kuwaiti areas search", async () => {
    await page.getByTestId("new-order").click();
    await page.getByTestId("pick-pickup").click();
    await page.getByTestId("area-search").fill("السالمية");
    await page.getByText("السالمية", { exact: true }).first().click();
    await shot("05-location-picker");
    await page.getByTestId("use-location").click();
    await page.getByTestId("pick-dropoff").click();
    await page.getByTestId("area-search").fill("حولي");
    await page.getByText("حولي", { exact: true }).first().click();
    await page.getByTestId("use-location").click();
    await page.getByTestId("cat-documents").click();
    await page.getByTestId("order-details").fill("ملف أوراق رسمية — يرجى التسليم باليد");
    await shot("06-new-order");
    await page.getByTestId("submit-order").click();
    await page.getByText("بانتظار عروض المناديب…").waitFor({ timeout: 30_000 });
    await shot("07-waiting-offers");
    const [o] = await sql("select o.status, o.category, o.pickup_address, o.dropoff_address from public.orders o join public.profiles p on p.id = o.customer_id where p.phone = $1", [`+965${phone}`]);
    expect(o).toMatchObject({ status: "open", category: "documents", pickup_address: "السالمية", dropoff_address: "حولي" });
  });

  it("receives offers live, compares and accepts one", async () => {
    const [{ id }] = await sql("select o.id from public.orders o join public.profiles p on p.id = o.customer_id where p.phone = $1", [`+965${phone}`]);
    const d1 = await makeActiveDriver(admin, "عبدالله المندوب");
    const d2 = await makeActiveDriver(admin, "سالم السريع");
    await d1.client.rpc("submit_offer", { p_order: id, p_price_fils: 2000, p_eta_minutes: 25, p_note: "جاهز الآن", p_lat: 29.34, p_lng: 48.07 });
    await d2.client.rpc("submit_offer", { p_order: id, p_price_fils: 1250, p_eta_minutes: 12, p_note: null, p_lat: 29.33, p_lng: 48.06 });
    await page.getByTestId("offer-1").waitFor({ timeout: 20_000 }); // arrives in realtime, no reload
    await shot("08-offers");
    await expect(page.getByTestId("offer-0").textContent()).resolves.toContain("سالم السريع"); // cheapest first
    await page.getByTestId("accept-0").click();
    await page.getByTestId("open-chat").waitFor({ timeout: 20_000 });
    await shot("09-accepted");
    const [o] = await sql("select status, driver_id, delivery_fee_fils from public.orders where id = $1", [id]);
    expect(o).toEqual({ status: "accepted", driver_id: d2.id, delivery_fee_fils: 1250 });

    // chat
    await page.getByTestId("open-chat").click();
    await page.getByTestId("chat-input").fill("السلام عليكم، البوابة رقم 2");
    await page.getByTestId("chat-send").click();
    await d2.client.from("messages").insert({ order_id: id, sender_id: d2.id, body: "وعليكم السلام، في الطريق" });
    await page.getByText("وعليكم السلام، في الطريق").waitFor({ timeout: 15_000 });
    await shot("10-chat");
    await page.goBack();

    // driver progresses the order; the UI follows in real time
    await d2.client.rpc("update_my_location", { p_lat: 29.335, p_lng: 48.07 });
    await d2.client.rpc("driver_update_status", { p_order: id, p_status: "picked_up", p_proof_path: await proof(d2, id) });
    await page.getByText("تم الاستلام — في الطريق إليك").filter({ visible: true }).first().waitFor({ timeout: 20_000 });
    await shot("11-tracking");
    await d2.client.rpc("driver_update_status", { p_order: id, p_status: "delivered", p_proof_path: await proof(d2, id) });
    await page.getByTestId("confirm-received").waitFor({ timeout: 20_000 });
    await page.getByTestId("confirm-received").click();
    await page.getByText("قيّم المندوب").filter({ visible: true }).first().waitFor({ timeout: 20_000 });
    await page.getByLabel("5 stars").filter({ visible: true }).first().click();
    await shot("12-rate");
    await page.getByText("إرسال", { exact: true }).filter({ visible: true }).first().click();
    await page.getByText("شكراً لتقييمك").filter({ visible: true }).first().waitFor({ timeout: 15_000 });
    const [c] = await sql("select status, commission_fils from public.orders where id = $1", [id]);
    expect(c).toEqual({ status: "completed", commission_fils: 188 });
    const [r] = await sql("select stars from public.ratings where order_id = $1", [id]);
    expect(r.stars).toBe(5);
  });

  it("works offline: an order created without internet is queued and sent automatically on reconnect", async () => {
    await page.goto(`http://127.0.0.1:${PORT}/home`);
    await page.getByTestId("new-order").waitFor({ timeout: 20_000 });
    const before = await sql("select count(*)::int n from public.orders o join public.profiles p on p.id = o.customer_id where p.phone = $1", [`+965${phone}`]);
    await page.getByTestId("new-order").click();
    await page.getByTestId("pick-pickup").click();
    await page.getByTestId("area-search").fill("الجابرية");
    await page.getByText("الجابرية", { exact: true }).first().click();
    await page.getByTestId("use-location").click();
    await page.getByTestId("pick-dropoff").click();
    await page.getByTestId("area-search").fill("مشرف");
    await page.getByText("مشرف", { exact: true }).first().click();
    await page.getByTestId("use-location").click();
    await page.getByTestId("order-details").fill("طلب أثناء انقطاع الإنترنت");
    await page.context().setOffline(true);
    await page.getByTestId("submit-order").click();
    await page.getByText("بانتظار الاتصال للإرسال").filter({ visible: true }).first().waitFor({ timeout: 20_000 });
    await shot("14-offline-queued");
    let after = await sql("select count(*)::int n from public.orders o join public.profiles p on p.id = o.customer_id where p.phone = $1", [`+965${phone}`]);
    expect(after[0].n).toBe(before[0].n);
    await page.context().setOffline(false);
    for (let i = 0; i < 40; i++) {
      after = await sql("select count(*)::int n from public.orders o join public.profiles p on p.id = o.customer_id where p.phone = $1", [`+965${phone}`]);
      if (after[0].n === before[0].n + 1) break;
      await page.waitForTimeout(500);
    }
    if (after[0].n !== before[0].n + 1) console.log("OUTBOX", await page.evaluate(() => localStorage.getItem("fazza.outbox.v1")));
    expect(after[0].n).toBe(before[0].n + 1);
    const [o] = await sql("select o.details, o.status from public.orders o join public.profiles p on p.id = o.customer_id where p.phone = $1 order by o.created_at desc limit 1", [`+965${phone}`]);
    expect(o).toEqual({ details: "طلب أثناء انقطاع الإنترنت", status: "open" });
  });

  it("switches to English (LTR) from the account screen", async () => {
    await page.goto(`http://127.0.0.1:${PORT}/account`);
    await page.getByText("English", { exact: true }).click();
    await page.getByText("Account", { exact: true }).first().waitFor({ timeout: 15_000 });
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("ltr");
    await shot("13-account-en");
    await page.getByText("العربية", { exact: true }).click();
  });
});
