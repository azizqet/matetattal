import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import { randomUUID } from "node:crypto";

export const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
export const ANON = process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
export const DB_URL = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
export const FN = `${URL}/functions/v1`;
export const PASSWORD = "Fazza2026pass";

export const pool = new pg.Pool({ connectionString: DB_URL, max: 5 });
export const sql = async <T = any>(q: string, params: unknown[] = []) => (await pool.query(q, params)).rows as T[];

export function uniquePhone(): string {
  return "5" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
}

export async function callFn(name: string, body: unknown, token?: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${FN}/${name}`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

export function anonClient(): SupabaseClient {
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface TestUser { id: string; phone: string; client: SupabaseClient; token: string }

export async function signup(name = "Test User", phone = uniquePhone()): Promise<TestUser> {
  // ensure uniqueness against previous runs
  for (let i = 0; i < 5; i++) {
    // Test-only: clear the per-IP signup limiter (all test users come from one IP).
    await sql("delete from public.rate_limits where key like 'signup_ip:%'");
    const r = await callFn("auth-signup", { full_name: name, phone, password: PASSWORD, accept_terms: true, locale: "en" });
    if (r.status === 201) {
      const s = r.body.session;
      const client = anonClient();
      await client.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
      return { id: s.user.id, phone: `+965${phone}`, client, token: s.access_token };
    }
    if (r.status !== 409) throw new Error(`signup failed ${r.status} ${JSON.stringify(r.body)}`);
    phone = uniquePhone();
  }
  throw new Error("could not find a free phone");
}

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

export async function upload(client: SupabaseClient, bucket: string, path: string) {
  const { error } = await client.storage.from(bucket).upload(path, PNG, { contentType: "image/png", upsert: false });
  return error;
}

export async function makeAdmin(role: "owner" | "admin" | "finance" | "support" = "owner"): Promise<TestUser> {
  const u = await signup("Admin " + role);
  await sql("insert into public.admins (user_id, role) values ($1, $2)", [u.id, role]);
  return u;
}

export async function registerDriver(u: TestUser, plate = `P${Math.floor(Math.random() * 1e8)}`) {
  const kinds = ["photo", "civil_id_front", "civil_id_back", "driving_license", "vehicle_registration"];
  const docs = [];
  for (const k of kinds) {
    const path = `${u.id}/${k}-${randomUUID()}.png`;
    const err = await upload(u.client, "driver-docs", path);
    if (err) throw err;
    docs.push({ kind: k, path });
  }
  const { data, error } = await u.client.rpc("register_driver", {
    p_vehicle_type: "motorcycle", p_vehicle_model: "Honda", p_plate: plate, p_documents: docs,
  });
  if (error) throw error;
  return data;
}

/** Full flow to an approved, activated, online driver. */
export async function makeActiveDriver(admin: TestUser, name = "Driver"): Promise<TestUser> {
  const d = await signup(name);
  await registerDriver(d);
  let r = await admin.client.rpc("admin_review_driver", { p_driver: d.id, p_decision: "approve", p_reason: null });
  if (r.error) throw r.error;
  const path = `${d.id}/activation-${randomUUID()}.png`;
  const e = await upload(d.client, "receipts", path);
  if (e) throw e;
  const rec = await d.client.rpc("submit_receipt", { p_purpose: "activation_fee", p_amount_fils: 5000, p_image_path: path, p_reference: "T1" });
  if (rec.error) throw rec.error;
  r = await admin.client.rpc("admin_review_receipt", { p_receipt: rec.data, p_decision: "approve", p_approved_amount_fils: null, p_note: null });
  if (r.error) throw r.error;
  r = await d.client.rpc("set_online", { p_online: true });
  if (r.error) throw r.error;
  return d;
}

export const KUWAIT_CITY = { lat: 29.3759, lng: 47.9774 };
export const SALMIYA = { lat: 29.3339, lng: 48.0761 };

export function orderPayload(id = randomUUID(), extra: Record<string, unknown> = {}) {
  return {
    id,
    category: "parcel",
    details: "Small box, handle with care",
    pickup: { ...KUWAIT_CITY, address: "Kuwait City, Block 1", area_id: null },
    dropoff: { ...SALMIYA, address: "Salmiya, Block 10, Street 5", notes: "Building 7", area_id: null },
    recipient_name: "Recipient",
    recipient_phone: "60001234",
    ...extra,
  };
}

export async function createOrder(customer: TestUser, extra: Record<string, unknown> = {}): Promise<string> {
  const id = randomUUID();
  const { data, error } = await customer.client.rpc("create_order", { p: orderPayload(id, extra) });
  if (error) throw error;
  return data as string;
}

export async function offer(d: TestUser, orderId: string, price = 1500, eta = 20) {
  return d.client.rpc("submit_offer", { p_order: orderId, p_price_fils: price, p_eta_minutes: eta, p_note: null, p_lat: 29.37, p_lng: 47.98 });
}

export async function proof(d: TestUser, orderId: string): Promise<string> {
  const path = `proof/${orderId}/${d.id}/${randomUUID()}.png`;
  const e = await upload(d.client, "order-files", path);
  if (e) throw e;
  return path;
}

/** Drive an accepted order to completion. */
export async function completeOrder(customer: TestUser, d: TestUser, orderId: string) {
  let r = await d.client.rpc("driver_update_status", { p_order: orderId, p_status: "picked_up", p_proof_path: await proof(d, orderId) });
  if (r.error) throw r.error;
  r = await d.client.rpc("driver_update_status", { p_order: orderId, p_status: "delivered", p_proof_path: await proof(d, orderId) });
  if (r.error) throw r.error;
  r = await customer.client.rpc("confirm_delivery", { p_order: orderId });
  if (r.error) throw r.error;
}

export function code(err: { message?: string } | null): string | undefined {
  return err?.message?.match(/FZ_[A-Z_]+(?::[a-z_]+)?/)?.[0];
}

export async function resetSettings() {
  await sql(`update public.app_settings set activation_fee_fils = 5000, commission_bps = 1500, debt_limit_fils = 5000,
             require_proof_photos = true, max_active_orders_per_driver = 3, maintenance_mode = false where id = 1`);
}
