import { useState } from "react";
import { filsToKwdString, parseKwdToFils } from "@fazza/shared";
import { Badge, Btn, Card, Empty, Field, Loader, Modal, SignedImage, kwd, toast, toastError, toneOf, useLoad } from "../components";
import { rpc } from "../lib/api";
import { fmtDate, tr } from "../lib/i18n";
import { supabase } from "../lib/supabase";

interface R { id: string; driver_id: string; purpose: string; amount_fils: number; approved_amount_fils: number | null; image_path: string; reference: string | null; status: string; review_note: string | null; created_at: string; reviewed_at: string | null; profiles: { full_name: string; phone: string } | null }

export default function Payments() {
  const [status, setStatus] = useState("pending");
  const [sel, setSel] = useState<R | null>(null);
  const list = useLoad(async () => {
    let q = supabase.from("payment_receipts").select("*, profiles(full_name, phone)").order("created_at", { ascending: status === "pending" }).limit(200);
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    return data as R[];
  }, [status]);
  return (
    <>
      <div className="alert">{tr("لا يُعتمد أي سداد تلقائياً. تحقق من وصول المبلغ فعلياً إلى حساب الشركة قبل الاعتماد.", "Nothing is approved automatically. Confirm the money actually reached the company account before approving.")}</div>
      <Card title={tr("إيصالات السداد", "Payment receipts")} actions={
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 160 }}>{["pending", "approved", "rejected", "all"].map((s) => <option key={s}>{s}</option>)}</select>}>
        {!list.data ? <Loader error={list.error} /> : list.data.length === 0 ? <Empty /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{tr("المندوب", "Driver")}</th><th>{tr("الغرض", "Purpose")}</th><th>{tr("المبلغ", "Amount")}</th><th>{tr("المرجع", "Reference")}</th><th>{tr("الحالة", "Status")}</th><th>{tr("التاريخ", "Date")}</th></tr></thead>
            <tbody>{list.data.map((r) => (
              <tr key={r.id} className="click" onClick={() => setSel(r)}>
                <td>{r.profiles?.full_name ?? tr("حساب محذوف", "Deleted account")} <span className="num">{r.profiles?.phone}</span></td>
                <td>{r.purpose === "activation_fee" ? tr("رسوم التفعيل", "Activation fee") : tr("عمولات", "Commission")}</td>
                <td className="num">{kwd(r.approved_amount_fils ?? r.amount_fils)}</td><td className="num">{r.reference ?? "—"}</td>
                <td><Badge tone={toneOf(r.status)}>{r.status}</Badge></td><td>{fmtDate(r.created_at)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
      {sel ? <ReceiptModal r={sel} onClose={() => setSel(null)} onDone={() => { setSel(null); list.reload(); }} /> : null}
    </>
  );
}

function ReceiptModal({ r, onClose, onDone }: { r: R; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(filsToKwdString(r.amount_fils));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const decide = async (decision: "approve" | "reject") => {
    const fils = parseKwdToFils(amount);
    if (decision === "approve" && !fils) return toast(tr("مبلغ غير صالح", "Invalid amount"), "danger");
    setBusy(decision);
    try {
      await rpc("admin_review_receipt", { p_receipt: r.id, p_decision: decision, p_approved_amount_fils: decision === "approve" ? fils : null, p_note: note || null });
      toast(tr("تم", "Done")); onDone();
    } catch (e) { toastError(e); } finally { setBusy(null); }
  };
  return (
    <Modal open title={tr("مراجعة إيصال", "Review receipt")} onClose={onClose} footer={r.status === "pending" ? <>
      <Btn kind="danger" busy={busy === "reject"} onClick={() => decide("reject")}>{tr("رفض", "Reject")}</Btn>
      <Btn kind="success" busy={busy === "approve"} onClick={() => decide("approve")}>{tr("اعتماد السداد", "Approve payment")}</Btn></> : undefined}>
      <div>{r.profiles?.full_name} · <span className="num">{r.profiles?.phone}</span></div>
      <div>{tr("المبلغ المصرّح به", "Declared amount")}: <b className="num">{kwd(r.amount_fils)}</b> · {tr("المرجع", "Ref")}: <span className="num">{r.reference ?? "—"}</span></div>
      <SignedImage bucket="receipts" path={r.image_path} alt="receipt" />
      {r.status === "pending" ? <div className="form">
        <Field label={tr("المبلغ المعتمد (د.ك)", "Approved amount (KWD)")}><input dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label={tr("ملاحظة (إلزامية عند الرفض)", "Note (required to reject)")}><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div> : <div className="alert">{r.status} · {r.review_note ?? ""} · {fmtDate(r.reviewed_at)}</div>}
    </Modal>
  );
}
