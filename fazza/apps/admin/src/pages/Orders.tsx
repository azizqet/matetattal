import { useState } from "react";
import { formatDistance } from "@fazza/shared";
import { Badge, Btn, Card, Empty, Loader, Modal, SignedImage, kwd, toast, toastError, toneOf, useLoad } from "../components";
import { rpc } from "../lib/api";
import { fmtDate, lang, tr } from "../lib/i18n";
import { supabase } from "../lib/supabase";

export default function Orders() {
  const [status, setStatus] = useState("all");
  const [code, setCode] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const list = useLoad(async () => {
    let q = supabase.from("orders").select("id,code,status,category,pickup_address,dropoff_address,delivery_fee_fils,commission_fils,created_at,distance_m").order("created_at", { ascending: false }).limit(200);
    if (status !== "all") q = q.eq("status", status);
    if (code.trim()) q = q.ilike("code", `%${code.trim()}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }, [status, code]);
  return (
    <>
      <Card title={tr("الطلبات", "Orders")} actions={<>
        <input placeholder="FZ100001" value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 160 }} dir="ltr" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 160 }}>
          {["all", "open", "accepted", "picked_up", "delivered", "completed", "cancelled", "expired"].map((s) => <option key={s}>{s}</option>)}
        </select></>}>
        {!list.data ? <Loader error={list.error} /> : list.data.length === 0 ? <Empty /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>#</th><th>{tr("الحالة", "Status")}</th><th>{tr("من", "From")}</th><th>{tr("إلى", "To")}</th><th>{tr("المسافة", "Distance")}</th><th>{tr("الأجرة", "Fee")}</th><th>{tr("العمولة", "Commission")}</th><th>{tr("التاريخ", "Date")}</th></tr></thead>
            <tbody>{list.data.map((o) => (
              <tr key={o.id} className="click" onClick={() => setSel(o.id)}>
                <td className="num">{o.code}</td><td><Badge tone={toneOf(o.status)}>{o.status}</Badge></td>
                <td>{o.pickup_address}</td><td>{o.dropoff_address}</td><td>{formatDistance(o.distance_m, lang())}</td>
                <td className="num">{o.delivery_fee_fils ? kwd(o.delivery_fee_fils) : "—"}</td><td className="num">{o.commission_fils != null ? kwd(o.commission_fils) : "—"}</td><td>{fmtDate(o.created_at)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
      {sel ? <OrderModal id={sel} onClose={() => setSel(null)} onDone={() => { setSel(null); list.reload(); }} /> : null}
    </>
  );
}

function OrderModal({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const o = useLoad(() => rpc<Record<string, any>>("get_order", { p_order: id }), [id]);
  const ev = useLoad(async () => (await supabase.from("order_events").select("*").eq("order_id", id).order("id")).data ?? [], [id]);
  const offers = useLoad(() => rpc<any[]>("get_order_offers", { p_order: id }), [id]);
  const [busy, setBusy] = useState(false);
  const d = o.data;
  return (
    <Modal open title={d ? `${d.code}` : "…"} onClose={onClose} footer={d && !["completed", "cancelled", "expired"].includes(d.status) ? (
      <Btn kind="danger" busy={busy} onClick={async () => {
        const reason = prompt(tr("سبب الإلغاء", "Cancellation reason"));
        if (!reason) return;
        setBusy(true);
        try { await rpc("admin_cancel_order", { p_order: id, p_reason: reason }); toast(tr("تم الإلغاء", "Cancelled")); onDone(); } catch (e) { toastError(e); } finally { setBusy(false); }
      }}>{tr("إلغاء الطلب (إداري)", "Cancel order (admin)")}</Btn>) : undefined}>
      {!d ? <Loader error={o.error} /> : (
        <>
          <div className="row"><Badge tone={toneOf(d.status)}>{d.status}</Badge><span>{d.category}</span><span className="num">{d.delivery_fee_fils ? kwd(d.delivery_fee_fils) : ""}</span></div>
          <div><b>{tr("العميل", "Customer")}:</b> {d.customer?.full_name} <span className="num">{d.customer?.phone}</span></div>
          {d.driver ? <div><b>{tr("المندوب", "Driver")}:</b> {d.driver.full_name} <span className="num">{d.driver.phone}</span> · {d.driver.plate_number}</div> : null}
          <div><b>{tr("الاستلام", "Pickup")}:</b> {d.pickup_address} {d.pickup_notes ?? ""}</div>
          <div><b>{tr("التسليم", "Drop-off")}:</b> {d.dropoff_address} {d.dropoff_notes ?? ""}</div>
          <div>{d.details}</div>
          {d.cancel_reason ? <div className="alert tone-danger">{d.cancel_reason}</div> : null}
          <div className="docs">{[...(d.image_paths ?? []), d.pickup_proof_path, d.delivery_proof_path].filter(Boolean).map((p: string) => <SignedImage key={p} bucket="order-files" path={p} alt="" />)}</div>
          {offers.data?.length ? <><h4>{tr("العروض", "Offers")}</h4><table><tbody>{offers.data.map((x) => <tr key={x.offer_id}><td>{x.driver_name}</td><td className="num">{kwd(x.price_fils)}</td><td>{x.eta_minutes}′</td><td>{x.status}</td></tr>)}</tbody></table></> : null}
          <h4>{tr("السجل", "Timeline")}</h4>
          <table><tbody>{(ev.data ?? []).map((e) => <tr key={e.id}><td>{e.from_status ?? ""} → {e.to_status}</td><td>{e.note ?? ""}</td><td>{fmtDate(e.created_at)}</td></tr>)}</tbody></table>
        </>
      )}
    </Modal>
  );
}
