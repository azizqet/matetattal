import { useState } from "react";
import type { Me } from "../App";
import { Badge, Btn, Card, Empty, Loader, Modal, kwd, toast, toastError, toneOf, useLoad } from "../components";
import { callFunction, rpc } from "../lib/api";
import { fmtDate, tr } from "../lib/i18n";

interface U { id: string; full_name: string; phone: string; phone_verified: boolean; status: string; created_at: string; driver_status: string | null; balance_fils: number | null; is_admin: boolean; last_sign_in_at: string | null }

export default function Users({ me }: { me: Me }) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<U | null>(null);
  const [temp, setTemp] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const list = useLoad(() => rpc<U[]>("admin_search_users", { p_query: query, p_limit: 100, p_offset: 0 }), [query]);
  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try { await fn(); toast(tr("تم", "Done")); list.reload(); setSel(null); } catch (e) { toastError(e); } finally { setBusy(null); }
  };
  return (
    <>
      <Card title={tr("المستخدمون", "Users")} actions={
        <form className="row" onSubmit={(e) => { e.preventDefault(); setQuery(q); }}>
          <input placeholder={tr("بحث بالاسم أو الهاتف", "Search name or phone")} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
          <Btn type="submit" small>{tr("بحث", "Search")}</Btn>
        </form>}>
        {!list.data ? <Loader error={list.error} /> : list.data.length === 0 ? <Empty /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{tr("الاسم", "Name")}</th><th>{tr("الهاتف", "Phone")}</th><th>{tr("الحالة", "Status")}</th><th>{tr("مندوب", "Driver")}</th><th>{tr("آخر دخول", "Last sign-in")}</th><th>{tr("التسجيل", "Joined")}</th></tr></thead>
            <tbody>{list.data.map((u) => (
              <tr key={u.id} className="click" onClick={() => setSel(u)}>
                <td>{u.full_name} {u.is_admin ? <Badge>admin</Badge> : null}</td>
                <td className="num">{u.phone} {u.phone_verified ? "✓" : ""}</td>
                <td><Badge tone={toneOf(u.status)}>{u.status}</Badge></td>
                <td>{u.driver_status ? <Badge tone={toneOf(u.driver_status)}>{u.driver_status}</Badge> : "—"}</td>
                <td>{fmtDate(u.last_sign_in_at)}</td><td>{fmtDate(u.created_at, false)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
      {sel ? (
        <Modal open title={`${sel.full_name} · ${sel.phone}`} onClose={() => { setSel(null); setTemp(null); }}>
          <div className="row">
            <Badge tone={toneOf(sel.status)}>{sel.status}</Badge>
            <Badge tone={sel.phone_verified ? "success" : "warning"}>{sel.phone_verified ? tr("الهاتف موثق", "Phone verified") : tr("الهاتف غير موثق", "Phone not verified")}</Badge>
            {sel.balance_fils != null ? <Badge>{tr("المستحق", "Owed")}: {kwd(sel.balance_fils)}</Badge> : null}
          </div>
          <div className="alert">{tr("استعادة كلمة المرور: تحقّق أولاً من هوية صاحب الحساب بالاتصال على رقمه المسجّل (وللمناديب مطابقة البطاقة المدنية)، ثم أصدر كلمة مرور مؤقتة وأبلغه بها شفهياً. سيُطلب منه تغييرها فور الدخول.",
            "Password recovery: first verify the owner's identity by calling the registered number (and matching the civil ID for drivers), then issue a temporary password and tell it verbally. They must change it at next sign-in.")}</div>
          {temp ? <div className="secret">{temp}</div> : null}
          <div className="row">
            <Btn kind="ghost" busy={busy === "pw"} onClick={async () => {
              if (!confirm(tr("هل تحققت من هوية صاحب الحساب؟", "Did you verify the account owner's identity?"))) return;
              setBusy("pw");
              try { const r = await callFunction<{ temp_password: string }>("admin-reset-password", { user_id: sel.id }); setTemp(r.temp_password); }
              catch (e) { toastError(e); } finally { setBusy(null); }
            }}>{tr("إصدار كلمة مرور مؤقتة", "Issue temporary password")}</Btn>
            <Btn kind="ghost" busy={busy === "verify"} onClick={() => act("verify", () => rpc("admin_set_phone_verified", { p_user: sel.id, p_verified: !sel.phone_verified }))}>
              {sel.phone_verified ? tr("إلغاء توثيق الهاتف", "Unverify phone") : tr("توثيق الهاتف", "Verify phone")}</Btn>
            {sel.status === "active"
              ? <Btn kind="danger" busy={busy === "susp"} onClick={() => { const r = prompt(tr("سبب الإيقاف", "Reason")); if (r) act("susp", () => rpc("admin_set_user_status", { p_user: sel.id, p_status: "suspended", p_reason: r })); }}>{tr("إيقاف الحساب", "Suspend")}</Btn>
              : <Btn kind="success" busy={busy === "act"} onClick={() => act("act", () => rpc("admin_set_user_status", { p_user: sel.id, p_status: "active", p_reason: null }))}>{tr("تفعيل الحساب", "Activate")}</Btn>}
          </div>
          {me.role === "owner" ? (
            <div className="row">
              <span>{tr("صلاحية إدارية", "Admin role")}:</span>
              {(["admin", "finance", "support"] as const).map((r) => <Btn key={r} small kind="ghost" onClick={() => act(`role-${r}`, () => rpc("admin_set_admin", { p_user: sel.id, p_role: r }))}>{r}</Btn>)}
              <Btn small kind="danger" onClick={() => act("role-none", () => rpc("admin_set_admin", { p_user: sel.id, p_role: null }))}>{tr("إزالة", "Remove")}</Btn>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}
