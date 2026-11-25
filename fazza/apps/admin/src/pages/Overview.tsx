import { BarChart, Card, Loader, Stat, kwd, useLoad } from "../components";
import { rpc } from "../lib/api";
import { tr } from "../lib/i18n";

type Stats = Record<string, number>;
const iso = (d: Date) => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);

export default function Overview() {
  const s = useLoad(() => rpc<Stats>("admin_stats"));
  const report = useLoad(() => {
    const to = new Date(); const from = new Date(Date.now() - 13 * 86400_000);
    return rpc<{ day: string; commission_fils: number; orders_completed: number }[]>("admin_financial_report", { p_from: iso(from), p_to: iso(to) }).catch(() => []);
  });
  if (!s.data) return <Loader error={s.error} />;
  const d = s.data;
  return (
    <>
      <div className="grid" style={{ marginBottom: 16 }}>
        <Stat label={tr("إجمالي المستخدمين", "Users")} value={d.customers} />
        <Stat label={tr("المناديب المعتمدون", "Approved drivers")} value={d.drivers_approved} hint={`${tr("متصل الآن", "online")}: ${d.drivers_online}`} />
        <Stat label={tr("طلبات تسجيل بانتظار المراجعة", "Pending driver applications")} value={d.drivers_pending} tone={d.drivers_pending ? "warning" : "primary"} />
        <Stat label={tr("نشطون (24 ساعة / 30 يوم)", "Active (24h / 30d)")} value={`${d.active_users_24h} / ${d.active_users_30d}`} />
        <Stat label={tr("طلبات مفتوحة", "Open orders")} value={d.orders_open} tone="warning" />
        <Stat label={tr("قيد التنفيذ", "In progress")} value={d.orders_in_progress} />
        <Stat label={tr("مكتملة", "Completed")} value={d.orders_completed} tone="success" />
        <Stat label={tr("ملغاة / منتهية", "Cancelled / expired")} value={`${d.orders_cancelled} / ${d.orders_expired}`} tone="danger" />
      </div>
      <Card title={tr("الإيرادات (عمولة التطبيق)", "Revenue (app commission)")}>
        <div className="grid">
          <Stat label={tr("اليوم", "Today")} value={kwd(d.commission_today_fils)} tone="success" />
          <Stat label={tr("هذا الشهر", "This month")} value={kwd(d.commission_month_fils)} tone="success" />
          <Stat label={tr("هذه السنة", "This year")} value={kwd(d.commission_year_fils)} tone="success" />
          <Stat label={tr("المحصّل هذا الشهر (إيصالات معتمدة)", "Collected this month")} value={kwd(d.collected_month_fils)} />
          <Stat label={tr("مستحقات غير مسددة", "Outstanding dues")} value={kwd(d.outstanding_fils)} tone="warning" hint={`${d.drivers_blocked_debt} ${tr("مندوب موقوف بسبب الحد", "drivers at limit")}`} />
          <Stat label={tr("قيمة التوصيل (GMV) هذا الشهر", "Delivery GMV this month")} value={kwd(d.gmv_month_fils)} />
        </div>
      </Card>
      <div className="cols-2">
        <Card title={tr("العمولة آخر 14 يوماً", "Commission, last 14 days")}>
          {report.data ? <BarChart data={report.data.map((r) => ({ label: r.day.slice(5), value: r.commission_fils }))} /> : <Loader />}
        </Card>
        <Card title={tr("بانتظار إجراء", "Needs action")}>
          <div className="grid">
            <a href="#/drivers"><Stat label={tr("طلبات مناديب", "Driver applications")} value={d.drivers_pending} tone="warning" /></a>
            <a href="#/payments"><Stat label={tr("إيصالات للمراجعة", "Receipts to review")} value={d.receipts_pending} tone="warning" /></a>
            <a href="#/tickets"><Stat label={tr("تذاكر مفتوحة", "Open tickets")} value={d.tickets_open} tone="warning" /></a>
          </div>
        </Card>
      </div>
    </>
  );
}
