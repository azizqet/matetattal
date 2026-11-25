import { useState } from "react";
import { normalizeKwPhone } from "@fazza/shared";
import { Btn, Card, Empty, Field, Loader, toast, toastError, useLoad } from "../components";
import { rpc } from "../lib/api";
import { fmtDate, tr } from "../lib/i18n";
import { supabase } from "../lib/supabase";

export default function Broadcast() {
  const [f, setF] = useState({ audience: "all", phone: "", title_ar: "", title_en: "", body_ar: "", body_en: "" });
  const [busy, setBusy] = useState(false);
  const history = useLoad(async () => (await supabase.from("broadcasts").select("*").order("created_at", { ascending: false }).limit(50)).data ?? []);
  const send = async () => {
    setBusy(true);
    try {
      let userId: string | null = null;
      if (f.audience === "user") {
        const p = normalizeKwPhone(f.phone);
        const { data } = await supabase.from("profiles").select("id").eq("phone", p ?? "").maybeSingle();
        if (!data) throw new Error("FZ_NOT_FOUND");
        userId = data.id;
      }
      const n = await rpc<number>("admin_broadcast", { p_audience: f.audience, p_user: userId, p_title_ar: f.title_ar, p_title_en: f.title_en || f.title_ar, p_body_ar: f.body_ar, p_body_en: f.body_en || f.body_ar });
      toast(`${tr("أُرسل إلى", "Sent to")} ${n}`); history.reload();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  return (
    <>
      <Card title={tr("إرسال إشعار", "Send notification")}>
        <div className="form">
          <Field label={tr("الجمهور", "Audience")}><select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
            <option value="all">{tr("جميع المستخدمين", "All users")}</option><option value="customers">{tr("العملاء", "Customers")}</option>
            <option value="drivers">{tr("المناديب المعتمدون", "Approved drivers")}</option><option value="user">{tr("مستخدم محدد", "Specific user")}</option></select></Field>
          {f.audience === "user" ? <Field label={tr("رقم الهاتف", "Phone")}><input dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field> : null}
          <Field label={tr("العنوان (عربي)", "Title (Arabic)")}><input value={f.title_ar} onChange={(e) => setF({ ...f, title_ar: e.target.value })} /></Field>
          <Field label={tr("العنوان (إنجليزي)", "Title (English)")}><input dir="ltr" value={f.title_en} onChange={(e) => setF({ ...f, title_en: e.target.value })} /></Field>
        </div>
        <div className="cols-2" style={{ marginTop: 12 }}>
          <Field label={tr("النص (عربي)", "Body (Arabic)")}><textarea value={f.body_ar} onChange={(e) => setF({ ...f, body_ar: e.target.value })} /></Field>
          <Field label={tr("النص (إنجليزي)", "Body (English)")}><textarea dir="ltr" value={f.body_en} onChange={(e) => setF({ ...f, body_en: e.target.value })} /></Field>
        </div>
        <div className="row end"><Btn busy={busy} disabled={!f.title_ar || !f.body_ar} onClick={() => confirm(tr("تأكيد الإرسال؟", "Send now?")) && send()}>{tr("إرسال", "Send")}</Btn></div>
      </Card>
      <Card title={tr("السجل", "History")}>
        {!history.data ? <Loader /> : history.data.length === 0 ? <Empty /> : <div className="table-wrap"><table><tbody>
          {history.data.map((b) => <tr key={b.id}><td>{b.audience}</td><td>{b.title_ar}</td><td>{b.recipients}</td><td>{fmtDate(b.created_at)}</td></tr>)}
        </tbody></table></div>}
      </Card>
    </>
  );
}
