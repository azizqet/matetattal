import { useState } from "react";
import { Badge, Btn, Card, Empty, Field, Loader, Modal, toast, toastError, toneOf, useLoad } from "../components";
import { callFunction, rpc } from "../lib/api";
import { fmtDate, tr } from "../lib/i18n";
import { supabase } from "../lib/supabase";

export default function Tickets() {
  const [status, setStatus] = useState("open");
  const [kind, setKind] = useState("all");
  const [sel, setSel] = useState<any | null>(null);
  const list = useLoad(async () => {
    let q = supabase.from("tickets").select("*, reporter:profiles!tickets_user_id_fkey(full_name, phone)").order("created_at", { ascending: false }).limit(200);
    if (status !== "all") q = q.eq("status", status);
    if (kind !== "all") q = q.eq("kind", kind);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }, [status, kind]);
  return (
    <>
      <Card title={tr("الدعم الفني والشكاوى والبلاغات", "Support, complaints & reports")} actions={<>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 180 }}>{["all", "support", "complaint", "report_user", "report_message", "password_reset", "account_deletion"].map((s) => <option key={s}>{s}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 150 }}>{["open", "in_progress", "resolved", "rejected", "all"].map((s) => <option key={s}>{s}</option>)}</select></>}>
        {!list.data ? <Loader error={list.error} /> : list.data.length === 0 ? <Empty /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{tr("النوع", "Type")}</th><th>{tr("الموضوع", "Subject")}</th><th>{tr("المرسل", "From")}</th><th>{tr("الحالة", "Status")}</th><th>{tr("التاريخ", "Date")}</th></tr></thead>
            <tbody>{list.data.map((t) => (
              <tr key={t.id} className="click" onClick={() => setSel(t)}>
                <td><Badge tone={t.kind.startsWith("report") || t.kind === "complaint" ? "danger" : "primary"}>{t.kind}</Badge></td>
                <td>{t.subject}</td><td>{t.reporter?.full_name ?? t.contact_name} <span className="num">{t.reporter?.phone ?? t.contact_phone}</span></td>
                <td><Badge tone={toneOf(t.status)}>{t.status}</Badge></td><td>{fmtDate(t.created_at)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
      {sel ? <TicketModal t={sel} onClose={() => setSel(null)} onDone={() => { setSel(null); list.reload(); }} /> : null}
    </>
  );
}

function TicketModal({ t, onClose, onDone }: { t: any; onClose: () => void; onDone: () => void }) {
  const thread = useLoad(async () => (await supabase.from("ticket_messages").select("*").eq("ticket_id", t.id).order("id")).data ?? [], [t.id]);
  const msg = useLoad(async () => (t.message_id ? (await supabase.from("messages").select("*").eq("id", t.message_id).maybeSingle()).data : null), [t.message_id]);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState(t.admin_note ?? "");
  const [temp, setTemp] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const save = async (status: string) => {
    setBusy(status);
    try { await rpc("admin_update_ticket", { p_ticket: t.id, p_status: status, p_note: note || null, p_reply: reply || null }); toast(tr("تم", "Done")); onDone(); }
    catch (e) { toastError(e); } finally { setBusy(null); }
  };
  return (
    <Modal open title={t.subject} onClose={onClose} footer={<>
      <Btn kind="ghost" busy={busy === "rejected"} onClick={() => save("rejected")}>{tr("رفض", "Reject")}</Btn>
      <Btn kind="ghost" busy={busy === "in_progress"} onClick={() => save("in_progress")}>{tr("قيد المعالجة", "In progress")}</Btn>
      <Btn kind="success" busy={busy === "resolved"} onClick={() => save("resolved")}>{tr("تم الحل", "Resolve")}</Btn></>}>
      <div className="row"><Badge>{t.kind}</Badge><Badge tone={toneOf(t.status)}>{t.status}</Badge>{t.order_id ? <span>{tr("طلب", "Order")}: <span className="num">{t.order_id.slice(0, 8)}</span></span> : null}</div>
      <div>{t.reporter?.full_name ?? t.contact_name} · <span className="num">{t.reporter?.phone ?? t.contact_phone}</span></div>
      <div className="alert">{t.body}</div>
      {msg.data ? <div className="alert tone-warning"><b>{tr("الرسالة المُبلّغ عنها", "Reported message")}:</b> {msg.data.body ?? "[image]"}</div> : null}
      {t.kind === "password_reset" && t.user_id ? (
        <div className="alert tone-warning">
          {tr("اتصل بالرقم المسجّل للتحقق من الهوية قبل إصدار كلمة مرور مؤقتة. لا ترسلها في رسالة نصية عامة.", "Call the registered number to verify identity before issuing a temporary password.")}
          <div className="row" style={{ marginTop: 8 }}>
            <Btn kind="primary" busy={busy === "pw"} onClick={async () => {
              if (!confirm(tr("هل تحققت من الهوية؟", "Identity verified?"))) return;
              setBusy("pw");
              try { const r = await callFunction<{ temp_password: string }>("admin-reset-password", { user_id: t.user_id, ticket_id: t.id }); setTemp(r.temp_password); }
              catch (e) { toastError(e); } finally { setBusy(null); }
            }}>{tr("إصدار كلمة مرور مؤقتة", "Issue temporary password")}</Btn>
          </div>
          {temp ? <div className="secret" style={{ marginTop: 8 }}>{temp}</div> : null}
        </div>
      ) : null}
      {t.kind === "password_reset" && !t.user_id ? <div className="alert tone-danger">{tr("لا يوجد حساب مسجل بهذا الرقم.", "No account is registered with this number.")}</div> : null}
      {t.kind === "account_deletion" ? <div className="alert">{tr("طلب حذف من النموذج الخارجي: تحقّق من الهوية بالاتصال، ثم احذف الحساب من Supabase Auth (أو اطلب من المستخدم الحذف من داخل التطبيق).", "External deletion request: verify identity by phone, then delete the user (or ask them to delete in-app).")}</div> : null}
      <div className="thread">{(thread.data ?? []).map((m) => <div key={m.id} className={`msg ${m.from_staff ? "staff" : ""}`}>{m.body}<div style={{ fontSize: 11, opacity: .6 }}>{fmtDate(m.created_at)}</div></div>)}</div>
      <Field label={tr("رد للمستخدم (يصله إشعار)", "Reply to the user (notifies them)")}><textarea value={reply} onChange={(e) => setReply(e.target.value)} /></Field>
      <Field label={tr("ملاحظة داخلية", "Internal note")}><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  );
}
