/** End-to-end: the owner dashboard (production build) against the real local Supabase stack. */
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright";
import { PASSWORD, type TestUser, makeAdmin, pool, registerDriver, resetSettings, signup, sql, upload } from "../backend/helpers";
import { ROOT, chromium, serve } from "./support";

const PORT = 4179;
const SHOTS = `${ROOT}/docs/test-report/screens`;
let server: Server;
let browser: Browser;
let page: Page;
let owner: TestUser;

beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true });
  await resetSettings();
  owner = await makeAdmin("owner");
  server = await serve(`${ROOT}/apps/admin/dist`, PORT);
  browser = await chromium.launch();
  page = await (await browser.newContext({ viewport: { width: 1360, height: 860 }, locale: "ar-KW" })).newPage();
  page.on("dialog", (d) => d.type() === "prompt" ? d.accept("test reason") : d.accept());
  page.on("pageerror", (e) => console.error("PAGE ERROR", e.message));
}, 60_000);
afterAll(async () => { await browser?.close(); server?.close(); await resetSettings(); await pool.end(); });

describe("owner dashboard", () => {
  it("rejects non-admin accounts", async () => {
    const u = await signup("Normal User");
    await page.goto(`http://127.0.0.1:${PORT}/`);
    await page.locator("#phone").fill(u.phone);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "دخول" }).click();
    await page.getByText("هذا الحساب لا يملك صلاحيات إدارية.").waitFor({ timeout: 15_000 });
    await page.evaluate(() => sessionStorage.clear());
  });

  it("signs in and shows the overview", async () => {
    await page.goto(`http://127.0.0.1:${PORT}/`);
    await page.locator("#phone").fill(owner.phone);
    await page.locator("#password").fill(PASSWORD);
    await page.screenshot({ path: `${SHOTS}/admin-01-login.png` });
    await page.getByRole("button", { name: "دخول" }).click();
    await page.getByText("الإيرادات (عمولة التطبيق)").waitFor({ timeout: 20_000 });
    await page.screenshot({ path: `${SHOTS}/admin-02-overview.png` });
  });

  it("reviews a driver application with private documents and approves it", async () => {
    const d = await signup("سعد المندوب الجديد");
    await registerDriver(d);
    await page.goto(`http://127.0.0.1:${PORT}/#/drivers`);
    await page.getByText("سعد المندوب الجديد").click();
    await page.locator("img.thumb").first().waitFor({ timeout: 15_000 });
    await page.screenshot({ path: `${SHOTS}/admin-03-driver-review.png` });
    await page.getByRole("button", { name: "قبول وتفعيل" }).click();
    await page.getByText("تم الحفظ").waitFor();
    const [row] = await sql("select status, reviewed_by from public.drivers where user_id = $1", [d.id]);
    expect(row).toEqual({ status: "approved", reviewed_by: owner.id });

    // activation fee receipt -> approve from the receipts screen
    const path = `${d.id}/${randomUUID()}.png`;
    await upload(d.client, "receipts", path);
    await d.client.rpc("submit_receipt", { p_purpose: "activation_fee", p_amount_fils: 5000, p_image_path: path, p_reference: "KNET-778" });
    await page.goto(`http://127.0.0.1:${PORT}/#/payments`);
    await page.getByText("KNET-778").click();
    await page.screenshot({ path: `${SHOTS}/admin-04-receipt.png` });
    await page.getByRole("button", { name: "اعتماد السداد" }).click();
    await page.getByText("تم", { exact: true }).waitFor();
    const [drv] = await sql("select activation_paid from public.drivers where user_id = $1", [d.id]);
    expect(drv.activation_paid).toBe(true);
  });

  it("edits commission and support settings at runtime", async () => {
    await page.goto(`http://127.0.0.1:${PORT}/#/settings`);
    const pct = page.locator("label", { hasText: "نسبة العمولة %" }).locator("input");
    await pct.fill("12.5");
    await page.locator("section", { hasText: "الرسوم والعمولة" }).getByRole("button", { name: "حفظ" }).click();
    await page.getByText("تم الحفظ (يطبق فوراً دون تحديث التطبيق)").waitFor();
    const [s] = await sql("select commission_bps from public.app_settings");
    expect(s.commission_bps).toBe(1250);
    await page.screenshot({ path: `${SHOTS}/admin-05-settings.png` });
  });

  it("shows the financial report and the audit log", async () => {
    await page.goto(`http://127.0.0.1:${PORT}/#/finance`);
    await page.getByText("التقرير المالي").waitFor();
    await page.screenshot({ path: `${SHOTS}/admin-06-finance.png` });
    await page.goto(`http://127.0.0.1:${PORT}/#/audit`);
    await page.getByText("settings_updated").first().waitFor();
    await page.getByText("driver_approve").first().waitFor();
    await page.screenshot({ path: `${SHOTS}/admin-07-audit.png` });
  });

  it("is usable on a phone (responsive menu)", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`http://127.0.0.1:${PORT}/#/overview`);
    await page.getByRole("button", { name: "menu" }).click();
    await page.getByRole("link", { name: /الطلبات/ }).click();
    await page.getByRole("heading", { name: "الطلبات" }).first().waitFor();
    await page.screenshot({ path: `${SHOTS}/admin-08-mobile.png` });
  });
});
