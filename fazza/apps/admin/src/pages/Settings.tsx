import { useState, useEffect } from "react";
import { filsToKwdString, parseKwdToFils } from "@fazza/shared";
import { Btn, Card, Field, Loader, toast, toastError, useLoad } from "../components";
import { rpc } from "../lib/api";
import { fmtDate, tr } from "../lib/i18n";
import { supabase } from "../lib/supabase";

type S = Record<string, any>;
const MONEY = ["activation_fee_fils", "debt_limit_fils", "min_offer_fils", "max_offer_fils"];

export default function Settings() {
  const loaded = useLoad(async () => (await supabase.from("app_settings").select("*").single()).data as S);
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (loaded.data) setS({ ...loaded.data, ...Object.fromEntries(MONEY.map((k) => [k, filsToKwdString(loaded.data![k])])), commission_pct: (loaded.data.commission_bps / 100).toString() }); }, [loaded.data]);
  if (!s) return <Loader error={loaded.error} />;
  const set = (k: string, v: unknown) => setS({ ...s, [k]: v });
  const save = async (keys: string[]) => {
    const p: S = {};
    for (const k of keys) {
      if (MONEY.includes(k)) { const f = parseKwdToFils(String(s[k])); if (f === null) return toast(tr("مبلغ غير صالح", "Invalid amount"), "danger"); p[k] = f; }
      else if (k === "commission_pct") { const bps = Math.round(Number(s.commission_pct) * 100); if (!(bps >= 0 && bps <= 5000)) return toast(tr("نسبة غير صالحة", "Invalid percentage"), "danger"); p.commission_bps = bps; }
      else p[k] = s[k];
    }
    setBusy(true);
    try { await rpc("admin_update_settings", { p }); toast(tr("تم الحفظ (يطبق فوراً دون تحديث التطبيق)", "Saved (applies immediately, no app update needed)")); loaded.reload(); }
    catch (e) { toastError(e); } finally { setBusy(false); }
  };
  const txt = (k: string, label: string, dir?: string) => <Field label={label}><input dir={dir} value={s[k] ?? ""} onChange={(e) => set(k, e.target.value)} /></Field>;
  const num = (k: string, label: string) => <Field label={label}><input type="number" value={s[k]} onChange={(e) => set(k, Number(e.target.value))} /></Field>;
  return (
    <>
      <div className="alert">{tr("آخر تعديل", "Last updated")}: {fmtDate(s.updated_at)}</div>
      <Card title={tr("الرسوم والعمولة", "Fees & commission")} actions={<Btn busy={busy} onClick={() => save(["activation_fee_fils", "commission_pct", "debt_limit_fils", "min_offer_fils", "max_offer_fils"])}>{tr("حفظ", "Save")}</Btn>}>
        <div className="form">
          {txt("activation_fee_fils", tr("رسوم تفعيل المندوب (د.ك)", "Driver activation fee (KWD)"), "ltr")}
          {txt("commission_pct", tr("نسبة العمولة %", "Commission %"), "ltr")}
          {txt("debt_limit_fils", tr("حد المديونية لإيقاف الاستقبال (د.ك)", "Debt limit to pause orders (KWD)"), "ltr")}
          {txt("min_offer_fils", tr("أقل عرض سعر (د.ك)", "Min offer (KWD)"), "ltr")}
          {txt("max_offer_fils", tr("أعلى عرض سعر (د.ك)", "Max offer (KWD)"), "ltr")}
        </div>
      </Card>
      <Card title={tr("تشغيل الطلبات", "Order operations")} actions={<Btn busy={busy} onClick={() => save(["order_ttl_minutes", "offer_ttl_minutes", "max_active_orders_per_driver", "auto_complete_hours", "nearby_radius_km", "require_proof_photos"])}>{tr("حفظ", "Save")}</Btn>}>
        <div className="form">
          {num("order_ttl_minutes", tr("مهلة الطلب (دقيقة)", "Order TTL (min)"))}
          {num("offer_ttl_minutes", tr("مهلة العرض (دقيقة)", "Offer TTL (min)"))}
          {num("max_active_orders_per_driver", tr("أقصى طلبات نشطة للمندوب", "Max active orders per driver"))}
          {num("auto_complete_hours", tr("الإكمال التلقائي بعد التسليم (ساعة)", "Auto-complete after delivery (h)"))}
          {num("nearby_radius_km", tr("نطاق الطلبات القريبة (كم)", "Nearby radius (km)"))}
          <Field label={tr("إثبات بالصور إلزامي", "Proof photos required")}><select value={s.require_proof_photos ? "1" : "0"} onChange={(e) => set("require_proof_photos", e.target.value === "1")}><option value="1">✓</option><option value="0">✗</option></select></Field>
        </div>
      </Card>
      <Card title={tr("الدعم الفني والدفع", "Support & payment")} actions={<Btn busy={busy} onClick={() => save(["support_phone", "support_whatsapp", "support_hours_ar", "support_hours_en", "payment_link_url", "payment_instructions_ar", "payment_instructions_en", "account_deletion_url"])}>{tr("حفظ", "Save")}</Btn>}>
        <div className="form">
          {txt("support_phone", tr("هاتف الدعم", "Support phone"), "ltr")}
          {txt("support_whatsapp", tr("واتساب الدعم", "Support WhatsApp"), "ltr")}
          {txt("support_hours_ar", tr("ساعات الدعم (عربي)", "Support hours (AR)"))}
          {txt("support_hours_en", tr("ساعات الدعم (إنجليزي)", "Support hours (EN)"), "ltr")}
          {txt("payment_link_url", tr("رابط الدفع الخارجي المعتمد", "Approved external payment link"), "ltr")}
          {txt("account_deletion_url", tr("رابط طلب حذف الحساب (للمتجر)", "Account deletion URL (stores)"), "ltr")}
        </div>
        <div className="cols-2" style={{ marginTop: 12 }}>
          <Field label={tr("تعليمات الدفع (عربي)", "Payment instructions (AR)")}><textarea value={s.payment_instructions_ar} onChange={(e) => set("payment_instructions_ar", e.target.value)} /></Field>
          <Field label={tr("تعليمات الدفع (إنجليزي)", "Payment instructions (EN)")}><textarea dir="ltr" value={s.payment_instructions_en} onChange={(e) => set("payment_instructions_en", e.target.value)} /></Field>
        </div>
      </Card>
      <Card title={tr("الصيانة والإصدار", "Maintenance & version")} actions={<Btn busy={busy} onClick={() => save(["maintenance_mode", "maintenance_message_ar", "maintenance_message_en", "min_app_version"])}>{tr("حفظ", "Save")}</Btn>}>
        <div className="form">
          <Field label={tr("وضع الصيانة (يوقف الطلبات الجديدة)", "Maintenance mode (blocks new orders)")}><select value={s.maintenance_mode ? "1" : "0"} onChange={(e) => set("maintenance_mode", e.target.value === "1")}><option value="0">✗</option><option value="1">✓</option></select></Field>
          {txt("maintenance_message_ar", tr("رسالة الصيانة (عربي)", "Message (AR)"))}
          {txt("maintenance_message_en", tr("رسالة الصيانة (إنجليزي)", "Message (EN)"), "ltr")}
          {txt("min_app_version", tr("أقل إصدار مدعوم", "Minimum app version"), "ltr")}
        </div>
      </Card>
      <Card title={tr("الشروط والأحكام وسياسة الخصوصية", "Terms & privacy policy")} actions={<Btn busy={busy} onClick={() => save(["terms_ar", "terms_en", "privacy_ar", "privacy_en"])}>{tr("حفظ", "Save")}</Btn>}>
        <div className="cols-2">
          <Field label={tr("الشروط (عربي)", "Terms (AR)")}><textarea style={{ minHeight: 260 }} value={s.terms_ar} onChange={(e) => set("terms_ar", e.target.value)} /></Field>
          <Field label={tr("الشروط (إنجليزي)", "Terms (EN)")}><textarea dir="ltr" style={{ minHeight: 260 }} value={s.terms_en} onChange={(e) => set("terms_en", e.target.value)} /></Field>
          <Field label={tr("الخصوصية (عربي)", "Privacy (AR)")}><textarea style={{ minHeight: 260 }} value={s.privacy_ar} onChange={(e) => set("privacy_ar", e.target.value)} /></Field>
          <Field label={tr("الخصوصية (إنجليزي)", "Privacy (EN)")}><textarea dir="ltr" style={{ minHeight: 260 }} value={s.privacy_en} onChange={(e) => set("privacy_en", e.target.value)} /></Field>
        </div>
      </Card>
    </>
  );
}
