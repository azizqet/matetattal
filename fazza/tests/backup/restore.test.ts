/**
 * Disaster-recovery drill: back up the database, wipe it, restore, and verify that data and
 * accounts work again (users can sign in with their original passwords).
 * NOTE: this test resets the local database. Run it on its own: npm run test:backup
 */
import { execSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { PASSWORD, ROOT_DIR, callFn, pool, signup, sql } from "./util";

const TABLES = ["profiles", "drivers", "orders", "offers", "ledger_entries", "payment_receipts", "messages", "ratings", "audit_log", "notifications"];
afterAll(() => pool.end());

describe("backup & restore", () => {
  it("restores all data and keeps accounts usable", async () => {
    const u = await signup("Backup Probe");
    const before: Record<string, number> = {};
    for (const t of TABLES) before[t] = (await sql(`select count(*)::int n from public.${t}`))[0].n;
    const [{ n: users }] = await sql("select count(*)::int n from auth.users");
    const env = { ...process.env, LOCAL: "1", BACKUP_DIR: "/tmp/fazza-backup-test", BACKUP_PASSPHRASE: "test-passphrase-123" };
    const file = execSync(`${ROOT_DIR}/scripts/backup/backup.sh`, { cwd: ROOT_DIR, env, encoding: "utf8" }).trim().split("\n").pop()!;
    expect(file.endsWith(".tar.enc")).toBe(true);

    execSync("supabase db reset", { cwd: ROOT_DIR, stdio: "ignore" });
    for (let i = 0; i < 20; i++) { try { await pool.query("select 1"); break; } catch { await new Promise((r) => setTimeout(r, 1000)); } }
    execSync("docker restart supabase_edge_runtime_fazza", { stdio: "ignore" });
    const wiped = (await sql("select count(*)::int n from public.profiles"))[0].n;
    expect(wiped).toBe(0);

    execSync(`${ROOT_DIR}/scripts/backup/restore.sh ${file}`, { cwd: ROOT_DIR, env: { ...env, CONFIRM: "yes" }, stdio: "ignore" });
    for (const t of TABLES) expect([t, (await sql(`select count(*)::int n from public.${t}`))[0].n]).toEqual([t, before[t]]);
    expect((await sql("select count(*)::int n from auth.users"))[0].n).toBe(users);
    const [p] = await sql("select full_name from public.profiles where id = $1", [u.id]);
    expect(p.full_name).toBe("Backup Probe");
    // balances still consistent with the ledger
    const bad = await sql("select d.user_id from public.drivers d where d.balance_fils <> coalesce((select sum(amount_fils) from public.ledger_entries l where l.driver_id = d.user_id), 0)");
    expect(bad).toEqual([]);
    const login = await callFn("auth-login", { phone: u.phone, password: PASSWORD });
    expect(login.status).toBe(200);
  }, 300_000);
});
