/** Public site: legal pages render and the external account-deletion form creates a support ticket. */
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { pool, signup, sql } from "../backend/helpers";
import { ROOT, chromium, serve } from "./support";

let server: Server;
let browser: Browser;
beforeAll(async () => { server = await serve(`${ROOT}/apps/site/dist`, 8095); browser = await chromium.launch(); });
afterAll(async () => { await browser.close(); server.close(); await pool.end(); });

describe("public site", () => {
  it("serves privacy policy and terms in Arabic and English", async () => {
    const page = await browser.newPage();
    for (const [p, text] of [["privacy.html", "سياسة الخصوصية"], ["privacy-en.html", "Privacy Policy"], ["terms.html", "الشروط والأحكام"], ["terms-en.html", "Terms & Conditions"]]) {
      await page.goto(`http://127.0.0.1:8095/${p}`);
      await expect(page.locator("h1").textContent()).resolves.toContain(text);
    }
  });

  it("account deletion request form works without signing in", async () => {
    const u = await signup("Web Delete");
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:8095/delete-account.html");
    await page.fill("input[name=full_name]", "Web Delete");
    await page.fill("input[name=phone]", u.phone);
    await page.click("button");
    await page.locator(".ok").waitFor({ timeout: 10_000 });
    const [t] = await sql("select kind, user_id from public.tickets where contact_phone = $1", [u.phone]);
    expect(t).toEqual({ kind: "account_deletion", user_id: u.id });
  });
});
