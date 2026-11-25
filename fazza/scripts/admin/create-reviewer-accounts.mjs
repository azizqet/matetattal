// Creates the App Store / Google Play reviewer accounts (one customer, one approved & activated driver).
// Run from YOUR machine only. Never ship the service role key in the app.
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//   REVIEW_CUSTOMER_PHONE=+96550000001 REVIEW_DRIVER_PHONE=+96550000002 REVIEW_PASSWORD='ChooseAStrong1' \
//   node scripts/admin/create-reviewer-accounts.mjs
// The accounts are clearly named "App Review" and can be suspended from the admin panel after review.
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: KEY, REVIEW_CUSTOMER_PHONE, REVIEW_DRIVER_PHONE, REVIEW_PASSWORD } = process.env;
if (!SUPABASE_URL || !KEY || !REVIEW_CUSTOMER_PHONE || !REVIEW_DRIVER_PHONE || !REVIEW_PASSWORD) {
  console.error("Missing env. See the header of this file."); process.exit(1);
}
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const digits = (p) => p.replace(/[^0-9]/g, "");

async function ensureUser(phone, name) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, { method: "POST", headers: h,
    body: JSON.stringify({ phone: digits(phone), password: REVIEW_PASSWORD, phone_confirm: true, user_metadata: { full_name: name, locale: "en" } }) });
  const body = await res.json();
  if (res.ok) return body.id;
  const q = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&phone=eq.${encodeURIComponent("+" + digits(phone))}`, { headers: h });
  const [row] = await q.json();
  if (!row) throw new Error(`Cannot create ${phone}: ${JSON.stringify(body)}`);
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${row.id}`, { method: "PUT", headers: h, body: JSON.stringify({ password: REVIEW_PASSWORD }) });
  return row.id;
}

const customer = await ensureUser(REVIEW_CUSTOMER_PHONE, "App Review Customer");
const driver = await ensureUser(REVIEW_DRIVER_PHONE, "App Review Driver");
const up = (table, row) => fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(row) });
await up("drivers", { user_id: driver, status: "approved", vehicle_type: "car", vehicle_model: "Review", plate_number: "REVIEW-1",
  activation_fee_due_fils: 0, activation_paid: true, activation_paid_at: new Date().toISOString(), status_reason: "App Store / Google Play review account" });
await fetch(`${SUPABASE_URL}/rest/v1/audit_log`, { method: "POST", headers: h, body: JSON.stringify({ action: "review_accounts_created", target_type: "user", target_id: `${customer},${driver}` }) });
console.log("Reviewer accounts ready:\n  customer", REVIEW_CUSTOMER_PHONE, "\n  driver  ", REVIEW_DRIVER_PHONE, "\n  password: (the one you provided)");
