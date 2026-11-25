import { useState } from "react";
import { parseKwdToFils } from "@fazza/shared";
import { Badge, Btn, Card, Empty, Field, Loader, kwd, toast, toastError, useLoad } from "../components";
import { rpc } from "../lib/api";
import { fmtDate, tr } from "../lib/i18n";
import { supabase } from "../lib/supabase";

export default function Promos() {
  const list = useLoad(async () => (await supabase.from("promo_codes").select("*").order("created_at", { ascending: false })).data ?? []);
  const [f, setF] = useState({ code: "", kind: "activation_discount", percent_off: "100", credit: "", max_redemptions: "", valid_until: "" });
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      await rpc("admin_upsert_promo", { p: {
        code: f.code, kind: f.kind, percent_off: f.kind === "activation_discount" ? Number(f.percent_off) : null,
        credit_fils: f.kind === "commission_credit" ? parseKwdToFils(f.credit) : null,
        max_redemptions: f.max_redemptions ? Number(f.max_redemptions) : null, valid_until: f.valid_until || null,
      } });
      toast(tr("تم إنشاء الكود", "Code created")); list.reload(); setF({ ...f, code: "" });
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  return (
    <>
      <Card title={tr("كود خصم جديد", "New promo code")}>
        <div className="alert">{tr("أكواد الخصم للمناديب: خصم على رسوم التفعيل أو رصيد يُخصم من العمولات المستحقة. التطبيق لا يحدد أسعار التوصيل.", "Promo codes are for drivers: an activation-fee discount or a credit against commissions. FAZZA never sets delivery prices.")}</div>
        <div className="form">
          <Field label={tr("الكود", "Code")}><input dir="ltr" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="WELCOME2026" /></Field>
          <Field label={tr("النوع", "Type")}><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            <option value="activation_discount">{tr("خصم رسوم التفعيل %", "Activation discount %")}</option><option value="commission_credit">{tr("رصيد عمولات (د.ك)", "Commission credit (KWD)")}</option></select></Field>
          {f.kind === "activation_discount"
            ? <Field label="%"><input type="number" min={1} max={100} value={f.percent_off} onChange={(e) => setF({ ...f, percent_off: e.target.value })} /></Field>
            : <Field label={tr("الرصيد (د.ك)", "Credit (KWD)")}><input dir="ltr" value={f.credit} onChange={(e) => setF({ ...f, credit: e.target.value })} placeholder="1.000" /></Field>}
          <Field label={tr("الحد الأقصى للاستخدام", "Max redemptions")}><input type="number" value={f.max_redemptions} onChange={(e) => setF({ ...f, max_redemptions: e.target.value })} /></Field>
          <Field label={tr("صالح حتى", "Valid until")}><input type="date" value={f.valid_until} onChange={(e) => setF({ ...f, valid_until: e.target.value })} /></Field>
        </div>
        <div className="row end" style={{ marginTop: 12 }}><Btn busy={busy} disabled={f.code.length < 3} onClick={create}>{tr("إنشاء", "Create")}</Btn></div>
      </Card>
      <Card title={tr("الأكواد", "Codes")}>
        {!list.data ? <Loader /> : list.data.length === 0 ? <Empty /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{tr("الكود", "Code")}</th><th>{tr("القيمة", "Value")}</th><th>{tr("الاستخدام", "Used")}</th><th>{tr("حتى", "Until")}</th><th /></tr></thead>
            <tbody>{list.data.map((p) => (
              <tr key={p.id}>
                <td className="num"><b>{p.code}</b></td><td>{p.kind === "activation_discount" ? `${p.percent_off}%` : kwd(p.credit_fils)}</td>
                <td>{p.redeemed_count}{p.max_redemptions ? ` / ${p.max_redemptions}` : ""}</td><td>{fmtDate(p.valid_until, false)}</td>
                <td><Badge tone={p.active ? "success" : "danger"}>{p.active ? "active" : "off"}</Badge>{" "}
                  <Btn small kind="ghost" onClick={async () => { try { await rpc("admin_upsert_promo", { p: { id: p.id, active: !p.active, max_redemptions: p.max_redemptions, valid_until: p.valid_until } }); list.reload(); } catch (e) { toastError(e); } }}>
                    {p.active ? tr("إيقاف", "Disable") : tr("تفعيل", "Enable")}</Btn></td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}
