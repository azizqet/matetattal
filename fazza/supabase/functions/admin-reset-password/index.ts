// Support-assisted password recovery. Staff verify the caller's identity out-of-band
// (phone call to the registered number + civil ID check for drivers), then issue a temporary password.
import { authAdmin, db, rpcAsUser } from "../_shared/clients.ts";
import { fail, handleOptions, json, readJson } from "../_shared/http.ts";

function tempPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let out = letters[bytes[0] % letters.length] + digits[bytes[1] % digits.length];
  for (let i = 2; i < 12; i++) out += all[bytes[i] % all.length];
  return out;
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  const body = await readJson<{ user_id?: string; ticket_id?: string }>(req);
  if (!body?.user_id || !/^[0-9a-f-]{36}$/.test(body.user_id)) return fail("FZ_BAD_REQUEST");

  const { data: me } = await rpcAsUser<{ user_id: string; role: string }>(req, "admin_me");
  if (!me || !["owner", "admin", "support"].includes(me.role)) return fail("FZ_FORBIDDEN", 403);

  const { data: targets } = await db.select<{ role: string }>("admins", `select=role&user_id=eq.${body.user_id}`);
  const target = targets?.[0];
  if (target?.role === "owner" && me.role !== "owner") return fail("FZ_FORBIDDEN", 403);
  if (body.user_id === me.user_id) return fail("FZ_FORBIDDEN", 403);

  const password = tempPassword();
  const { error } = await authAdmin.updateUser(body.user_id, { password });
  if (error) return fail("FZ_NOT_FOUND", 404);
  await db.rpc("set_must_change_password", { p_user: body.user_id, p_value: true });
  await db.rpc("revoke_user_sessions", { p_user: body.user_id });
  await db.rpc("service_audit", {
    p_actor: me.user_id, p_action: "password_reset", p_target_type: "user", p_target_id: body.user_id,
    p_details: { ticket_id: body.ticket_id ?? null },
  });
  if (body.ticket_id) {
    if (/^[0-9a-f-]{36}$/.test(body.ticket_id)) {
      await db.update("tickets", `id=eq.${body.ticket_id}`, { status: "resolved", handled_by: me.user_id, admin_note: "Temporary password issued" });
    }
  }
  return json({ temp_password: password });
});
