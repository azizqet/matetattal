// In-app account deletion (App Store 5.1.1(v) / Google Play account deletion policy).
import { authAdmin, db, passwordGrant, revokeAccessToken, storage } from "../_shared/clients.ts";
import { fail, handleOptions, json, readJson } from "../_shared/http.ts";

async function removeFolder(bucket: string, prefix: string, depth = 0): Promise<number> {
  if (depth > 4) return 0;
  const { data } = await storage.list(bucket, prefix);
  if (!data?.length) return 0;
  let removed = 0;
  const files: string[] = [];
  for (const item of data) {
    const path = `${prefix}/${item.name}`;
    if (item.id === null) removed += await removeFolder(bucket, path, depth + 1);
    else files.push(path);
  }
  if (files.length) {
    await storage.remove(bucket, files);
    removed += files.length;
  }
  return removed;
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  const body = await readJson<{ password?: string }>(req);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return fail("FZ_NOT_AUTHENTICATED", 401);

  const { data: user } = await authAdmin.getUserFromToken(token);
  const uid = user?.id;
  if (!uid) return fail("FZ_NOT_AUTHENTICATED", 401);

  const { data: hits } = await db.rpc<number>("hit_rate_limit", { p_key: `delete:${uid}`, p_max: 5, p_window_seconds: 3600 });
  if ((hits ?? 0) > 5) return fail("FZ_RATE_LIMITED", 429);

  const { data: rows } = await db.select<{ phone: string }>("profiles", `select=phone&id=eq.${uid}`);
  const profile = rows?.[0];
  if (!profile) return fail("FZ_NOT_FOUND", 404);
  const check = await passwordGrant(profile.phone, body?.password ?? "");
  if (!check.session) return fail("FZ_INVALID_CREDENTIALS", 401);
  await revokeAccessToken(check.session.access_token);

  const { error: prepErr } = await db.rpc("prepare_account_deletion", { p_user: uid });
  if (prepErr) {
    if (prepErr.message.includes("FZ_ACTIVE_ORDERS")) return fail("FZ_ACTIVE_ORDERS", 409);
    console.error(prepErr.message);
    return fail("FZ_SERVER_ERROR", 500);
  }

  // Personal files are deleted. Payment receipts are retained (anonymised) for accounting obligations.
  await removeFolder("driver-docs", uid);
  await removeFolder("avatars", uid);
  await removeFolder("order-files", `orders/${uid}`);

  const { error } = await authAdmin.deleteUser(uid);
  if (error) {
    console.error(error.message);
    return fail("FZ_SERVER_ERROR", 500);
  }
  return json({ deleted: true });
});
