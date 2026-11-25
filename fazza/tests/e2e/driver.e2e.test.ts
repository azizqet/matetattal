/** End-to-end: driver journey in the app UI against the real local Supabase stack. */
import { mkdirSync } from "node:fs";
import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright";
import { PASSWORD, type TestUser, createOrder, makeAdmin, pool, resetSettings, signup, sql } from "../backend/helpers";
import { ROOT, chromium, serve } from "./support";

const PORT = 8094;
const SHOTS = process.env.STORE_SHOTS ? `${ROOT}/store/raw` : `${ROOT}/docs/test-report/screens`;
const DOC = `${ROOT}/tests/e2e/fixtures/doc.jpg`;
let server: Server;
let browser: Browser;
let page: Page;
let admin: TestUser;
let driver: TestUser;
let customer: TestUser;
let orderId: string;

async function shot(name: string) { await page.waitForTimeout(400); await page.screenshot({ path: `${SHOTS}/${name}.png` }); }
const visible = (text: string) => page.getByText(text, { exact: false }).filter({ visible: true }).first();

beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true });
  await resetSettings();
  admin = await makeAdmin();
  driver = await signup("خالد المندوب");
  customer = await signup("نورة العميلة");
  server = await serve(`${ROOT}/apps/mobile/dist-web`, PORT);
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: process.env.STORE_SHOTS ? { width: 430, height: 932 } : { width: 393, height: 852 }, deviceScaleFactor: process.env.STORE_SHOTS ? 3 : 1, locale: "ar-KW", geolocation: { latitude: 29.37, longitude: 47.98 }, permissions: ["geolocation"] });
  await ctx.addInitScript(() => localStorage.setItem("fazza.onboarded", "1"));
  page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  page.on("filechooser", (fc) => fc.setFiles(DOC));
  page.on("pageerror", (e) => console.error("PAGE ERROR", e.message));
}, 120_000);
afterEach(async (ctx) => { if (ctx.task.result?.state === "fail") await page.screenshot({ path: `${SHOTS}/FAILED-driver-${ctx.task.name.slice(0, 16)}.png` }); });
afterAll(async () => { await browser?.close(); server?.close(); await pool.end(); });

describe("driver journey in the app UI", () => {
  it("signs in and applies as a driver with documents", async () => {
    await page.goto(`http://127.0.0.1:${PORT}/login`);
    await page.getByTestId("login-phone").fill(driver.phone.replace("+965", ""));
    await page.getByTestId("login-password").fill(PASSWORD);
    await page.getByTestId("login-submit").click();
    await page.getByTestId("new-order").waitFor({ timeout: 20_000 });
    await page.goto(`http://127.0.0.1:${PORT}/driver/apply`);
    await page.getByTestId("plate").fill(`${Math.floor(10000 + Math.random() * 89999)} ك`);
    for (const label of ["صورتك الشخصية", "البطاقة المدنية (أمام)", "البطاقة المدنية (خلف)", "رخصة القيادة", "دفتر المركبة"]) {
      await page.getByLabel(label, { exact: true }).click();
      await page.waitForTimeout(300);
    }
    await shot("20-driver-apply");
    await page.getByTestId("submit-application").click();
    await visible("طلبك قيد المراجعة").waitFor({ timeout: 30_000 });
    await shot("21-driver-pending");
    const docs = await sql("select kind from public.driver_documents where driver_id = $1", [driver.id]);
    expect(docs.length).toBe(5);
    const [d] = await sql("select status from public.drivers where user_id = $1", [driver.id]);
    expect(d.status).toBe("pending");
  });

  it("after approval pays the activation fee with a receipt and goes online", async () => {
    await admin.client.rpc("admin_review_driver", { p_driver: driver.id, p_decision: "approve", p_reason: null });
    await visible("رسوم التفعيل").waitFor({ timeout: 20_000 }); // realtime status update, no reload
    await visible("ادفع وارفع الإيصال").click();
    await page.getByLabel("صورة الإيصال", { exact: true }).click();
    await page.waitForTimeout(300);
    await shot("22-driver-receipt");
    await page.getByTestId("submit-receipt").click();
    await page.waitForTimeout(1500);
    const [r] = await sql("select id, status, amount_fils from public.payment_receipts where driver_id = $1", [driver.id]);
    expect(r).toMatchObject({ status: "pending", amount_fils: 5000 });
    const finance = await makeAdmin("finance");
    await finance.client.rpc("admin_review_receipt", { p_receipt: r.id, p_decision: "approve" });
    await page.goto(`http://127.0.0.1:${PORT}/dashboard`);
    await page.getByTestId("online-switch").waitFor({ timeout: 20_000 });
    await page.getByTestId("online-switch").click();
    await visible("متصل").waitFor();
    await shot("23-driver-dashboard");
    const [d] = await sql("select is_online, activation_paid from public.drivers where user_id = $1", [driver.id]);
    expect(d).toEqual({ is_online: true, activation_paid: true });
  });

  it("sees a nearby request and sends a price offer", async () => {
    orderId = await createOrder(customer);
    const [{ code }] = await sql("select code from public.orders where id = $1", [orderId]);
    await page.goto(`http://127.0.0.1:${PORT}/requests`);
    await page.getByTestId(`open-${code}`).waitFor({ timeout: 20_000 });
    await shot("24-driver-requests");
    await page.getByTestId(`open-${code}`).click();
    await page.getByTestId("offer-price").fill("1.500");
    await visible("صافي لك بعد عمولة 15%: 1.275 د.ك").waitFor();
    await shot("25-driver-offer");
    await page.getByTestId("send-offer").click();
    await visible("عرضك الحالي: 1.500 د.ك").waitFor({ timeout: 15_000 });
    const [o] = await sql("select price_fils, status from public.offers where order_id = $1 and driver_id = $2", [orderId, driver.id]);
    expect(o).toEqual({ price_fils: 1500, status: "pending" });
  });

  it("is accepted, picks up and delivers with proof photos, then earns", async () => {
    const [{ id: offerId }] = await sql("select id from public.offers where order_id = $1 and status = 'pending'", [orderId]);
    await customer.client.rpc("accept_offer", { p_offer: offerId });
    await page.getByTestId("advance-status").waitFor({ timeout: 20_000 });
    await shot("26-driver-active-order");
    await page.getByTestId("advance-status").click();
    await visible("تم الاستلام — في الطريق إليك").waitFor({ timeout: 20_000 });
    await page.getByTestId("advance-status").click();
    await visible("بانتظار تأكيد العميل للاستلام").waitFor({ timeout: 20_000 });
    const [o] = await sql("select status, pickup_proof_path is not null as p1, delivery_proof_path is not null as p2 from public.orders where id = $1", [orderId]);
    expect(o).toEqual({ status: "delivered", p1: true, p2: true });
    await customer.client.rpc("confirm_delivery", { p_order: orderId });
    await page.goto(`http://127.0.0.1:${PORT}/wallet`);
    await visible("عمولة طلب").waitFor({ timeout: 20_000 });
    await shot("27-driver-wallet");
    const dash = (await driver.client.rpc("driver_dashboard")).data;
    expect(dash.today_earned_fils).toBe(1500);
    expect(dash.balance_fils).toBe(225);
  });
});
