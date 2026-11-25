import { useState } from "react";
import { filsToKwdString } from "@fazza/shared";
import { BarChart, Btn, Card, Field, Loader, Stat, kwd, useLoad } from "../components";
import { downloadCsv, rpc } from "../lib/api";
import { tr } from "../lib/i18n";

interface Row { day: string; orders_completed: number; gross_fees_fils: number; commission_fils: number; commission_collected_fils: number; activation_collected_fils: number; cancelled: number }
const iso = (d: Date) => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);

export default function Finance() {
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 29 * 86400_000)));
  const [to, setTo] = useState(() => iso(new Date()));
  const rep = useLoad(() => rpc<Row[]>("admin_financial_report", { p_from: from, p_to: to }), [from, to]);
  const sum = (k: keyof Row) => (rep.data ?? []).reduce((a, r) => a + Number(r[k]), 0);
  return (
    <>
      <Card title={tr("التقرير المالي", "Financial report")} actions={<>
        <Field label={tr("من", "From")}><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label={tr("إلى", "To")}><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Btn kind="ghost" disabled={!rep.data?.length} onClick={() => downloadCsv(`fazza-finance-${from}-${to}.csv`, (rep.data ?? []).map((r) => ({
          date: r.day, completed_orders: r.orders_completed, gross_delivery_fees_kwd: filsToKwdString(r.gross_fees_fils), commission_kwd: filsToKwdString(r.commission_fils),
          commission_collected_kwd: filsToKwdString(r.commission_collected_fils), activation_fees_collected_kwd: filsToKwdString(r.activation_collected_fils), cancelled_orders: r.cancelled,
        })))}>⬇ CSV</Btn></>}>
        {!rep.data ? <Loader error={rep.error} /> : (
          <>
            <div className="grid" style={{ marginBottom: 14 }}>
              <Stat label={tr("طلبات مكتملة", "Completed orders")} value={sum("orders_completed")} />
              <Stat label={tr("إجمالي أجور التوصيل", "Gross delivery fees")} value={kwd(sum("gross_fees_fils"))} />
              <Stat label={tr("العمولة المستحقة", "Commission accrued")} value={kwd(sum("commission_fils"))} tone="success" />
              <Stat label={tr("عمولات محصّلة", "Commission collected")} value={kwd(sum("commission_collected_fils"))} />
              <Stat label={tr("رسوم تفعيل محصّلة", "Activation fees collected")} value={kwd(sum("activation_collected_fils"))} />
            </div>
            <BarChart data={rep.data.map((r) => ({ label: r.day.slice(5), value: r.commission_fils }))} />
            <div className="table-wrap"><table>
              <thead><tr><th>{tr("اليوم", "Day")}</th><th>{tr("مكتملة", "Completed")}</th><th>{tr("الأجور", "Fees")}</th><th>{tr("العمولة", "Commission")}</th><th>{tr("محصّل", "Collected")}</th><th>{tr("تفعيل", "Activation")}</th><th>{tr("ملغاة", "Cancelled")}</th></tr></thead>
              <tbody>{rep.data.map((r) => <tr key={r.day}><td>{r.day}</td><td>{r.orders_completed}</td><td className="num">{kwd(r.gross_fees_fils)}</td><td className="num">{kwd(r.commission_fils)}</td><td className="num">{kwd(r.commission_collected_fils)}</td><td className="num">{kwd(r.activation_collected_fils)}</td><td>{r.cancelled}</td></tr>)}</tbody>
            </table></div>
          </>
        )}
      </Card>
    </>
  );
}
