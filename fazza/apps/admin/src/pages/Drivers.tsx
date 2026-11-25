import { useState } from "react";
import { Badge, Btn, Card, Empty, Field, Loader, Modal, SignedImage, kwd, toast, toastError, toneOf, useLoad } from "../components";
import { rpc } from "../lib/api";
import { fmtDate, tr } from "../lib/i18n";
import { supabase } from "../lib/supabase";

interface DriverRow {
  user_id: string; status: string; status_reason: string | null; vehicle_type: string; vehicle_model: string | null; plate_number: string;
  activation_paid: boolean; activation_fee_due_fils: number; is_online: boolean; balance_fils: number; completed_count: number;
  rating_sum: number; rating_count: number; created_at: string;
  profiles: { full_name: string; phone: string; phone_verified: boolean; status: string };
}
const DOC_LABELS: Record<string, [string, string]> = {
  photo: ["الصورة الشخصية", "Photo"], civil_id_front: ["البطاقة المدنية - أمام", "Civil ID front"], civil_id_back: ["البطاقة المدنية - خلف", "Civil ID back"],
  driving_license: ["رخصة القيادة", "Driving licence"], vehicle_registration: ["دفتر المركبة", "Vehicle registration"], permit: ["تصريح", "Permit"], other: ["أخرى", "Other"],
};

export default function Drivers() {
  const [status, setStatus] = useState("pending");
  const [sel, setSel] = useState<DriverRow | null>(null);
  const list = useLoad(async () => {
    let q = supabase.from("drivers").select("*, profiles!inner(full_name, phone, phone_verified, status)").order("created_at", { ascending: false }).limit(300);
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    return data as DriverRow[];
  }, [status]);
  return (
    <>
      <Card title={tr("المناديب", "Drivers")} actions={
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 200 }}>
          {["pending", "approved", "rejected", "suspended", "all"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>}>
        {!list.data ? <Loader error={list.error} /> : list.data.length === 0 ? <Empty /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{tr("الاسم", "Name")}</th><th>{tr("الهاتف", "Phone")}</th><th>{tr("المركبة", "Vehicle")}</th><th>{tr("الحالة", "Status")}</th><th>{tr("التفعيل", "Activation")}</th><th>{tr("المستحق", "Owed")}</th><th>{tr("التاريخ", "Date")}</th></tr></thead>
            <tbody>{list.data.map((d) => (
              <tr key={d.user_id} className="click" onClick={() => setSel(d)}>
                <td>{d.profiles.full_name}</td><td className="num">{d.profiles.phone}</td><td>{d.vehicle_type} · {d.plate_number}</td>
                <td><Badge tone={toneOf(d.status)}>{d.status}</Badge> {d.is_online ? <Badge tone="success">online</Badge> : null}</td>
                <td>{d.activation_paid ? <Badge tone="success">✓</Badge> : <Badge tone="warning">{kwd(d.activation_fee_due_fils)}</Badge>}</td>
                <td className="num">{kwd(d.balance_fils)}</td><td>{fmtDate(d.created_at, false)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
      {sel ? <DriverModal d={sel} onClose={() => setSel(null)} onDone={() => { setSel(null); list.reload(); }} /> : null}
    </>
  );
}

function DriverModal({ d, onClose, onDone }: { d: DriverRow; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [adj, setAdj] = useState({ amount: "", note: "", kind: "waiver" });
  const docs = useLoad(async () => (await supabase.from("driver_documents").select("*").eq("driver_id", d.user_id).order("created_at")).data ?? [], [d.user_id]);
  const ledger = useLoad(async () => (await supabase.from("ledger_entries").select("*").eq("driver_id", d.user_id).order("id", { ascending: false }).limit(50)).data ?? [], [d.user_id]);
  const act = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    try { await fn(); toast(msg); onDone(); } catch (e) { toastError(e); } finally { setBusy(null); }
  };
  const decide = (decision: string) => act(decision, () => rpc("admin_review_driver", { p_driver: d.user_id, p_decision: decision, p_reason: reason || null }), tr("تم الحفظ", "Saved"));
  return (
    <Modal open title={`${d.profiles.full_name} · ${d.profiles.phone}`} onClose={onClose} footer={
      <>
        {d.status === "pending" || d.status === "rejected" ? <Btn kind="success" busy={busy === "approve"} onClick={() => decide("approve")}>{tr("قبول وتفعيل", "Approve")}</Btn> : null}
        {d.status === "pending" ? <Btn kind="danger" busy={busy === "reject"} onClick={() => decide("reject")}>{tr("رفض", "Reject")}</Btn> : null}
        {d.status === "approved" ? <Btn kind="danger" busy={busy === "suspend"} onClick={() => decide("suspend")}>{tr("إيقاف", "Suspend")}</Btn> : null}
        {d.status === "suspended" ? <Btn kind="success" busy={busy === "reinstate"} onClick={() => decide("reinstate")}>{tr("إعادة تفعيل", "Reinstate")}</Btn> : null}
      </>}>
      <div className="row">
        <Badge tone={toneOf(d.status)}>{d.status}</Badge>
        <Badge tone={d.profiles.phone_verified ? "success" : "warning"}>{d.profiles.phone_verified ? tr("الهاتف موثق", "Phone verified") : tr("الهاتف غير موثق", "Phone not verified")}</Badge>
        <Btn small kind="ghost" busy={busy === "verify"} onClick={() => act("verify", () => rpc("admin_set_phone_verified", { p_user: d.user_id, p_verified: !d.profiles.phone_verified }), tr("تم", "Done"))}>
          {d.profiles.phone_verified ? tr("إلغاء التوثيق", "Unverify") : tr("توثيق الهاتف (بعد الاتصال)", "Mark verified (after call)")}
        </Btn>
      </div>
      <div>{d.vehicle_type} · {d.vehicle_model ?? ""} · <b>{d.plate_number}</b> — {tr("مكتملة", "completed")}: {d.completed_count} — {tr("التقييم", "rating")}: {d.rating_count ? (d.rating_sum / d.rating_count).toFixed(2) : "—"}</div>
      {d.status_reason ? <div className="alert tone-warning">{d.status_reason}</div> : null}
      <h4>{tr("المستندات (روابط مؤقتة 5 دقائق)", "Documents (5-minute signed links)")}</h4>
      {!docs.data ? <Loader /> : <div className="docs">{docs.data.map((x) => (
        <figure key={x.id}><SignedImage bucket="driver-docs" path={x.storage_path} alt={x.kind} /><figcaption>{tr(...(DOC_LABELS[x.kind] ?? [x.kind, x.kind]))} · {x.status}</figcaption></figure>
      ))}</div>}
      <Field label={tr("السبب / ملاحظة (إلزامي للرفض والإيقاف)", "Reason / note (required to reject or suspend)")}><textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <h4>{tr("المستحقات", "Dues")}: <span className="num">{kwd(d.balance_fils)}</span></h4>
      <div className="form">
        <Field label={tr("النوع", "Type")}><select value={adj.kind} onChange={(e) => setAdj({ ...adj, kind: e.target.value })}><option value="waiver">{tr("إعفاء (سالب)", "Waiver (negative)")}</option><option value="adjustment">{tr("تسوية", "Adjustment")}</option></select></Field>
        <Field label={tr("المبلغ بالفلس (سالب = خصم من المستحق)", "Amount in fils (negative reduces dues)")}><input dir="ltr" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} placeholder="-500" /></Field>
        <Field label={tr("ملاحظة", "Note")}><input value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} /></Field>
      </div>
      <div className="row"><Btn small kind="ghost" busy={busy === "adj"} disabled={!adj.amount || !adj.note}
        onClick={() => act("adj", () => rpc("admin_ledger_entry", { p_driver: d.user_id, p_kind: adj.kind, p_amount_fils: parseInt(adj.amount, 10), p_note: adj.note }), tr("تم القيد", "Entry added"))}>{tr("إضافة قيد", "Add entry")}</Btn></div>
      {ledger.data?.length ? <div className="table-wrap"><table><tbody>{ledger.data.map((l) => <tr key={l.id}><td>{l.kind}</td><td className="num">{kwd(l.amount_fils)}</td><td>{l.note}</td><td>{fmtDate(l.created_at)}</td></tr>)}</tbody></table></div> : null}
    </Modal>
  );
}
