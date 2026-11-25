import { useState } from "react";
import { Btn, Card, Empty, Loader, useLoad } from "../components";
import { downloadCsv } from "../lib/api";
import { fmtDate, tr } from "../lib/i18n";
import { supabase } from "../lib/supabase";

export default function Audit() {
  const [page, setPage] = useState(0);
  const list = useLoad(async () => {
    const { data, error } = await supabase.from("audit_log").select("*").order("id", { ascending: false }).range(page * 100, page * 100 + 99);
    if (error) throw error;
    // audit_log has no FK to profiles (entries must survive account deletion): resolve names separately.
    const ids = [...new Set(data.map((a) => a.actor_id).filter(Boolean))];
    const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
    const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
    return data.map((a) => ({ ...a, actor: a.actor_id ? { full_name: names.get(a.actor_id) ?? a.actor_id.slice(0, 8) } : null }));
  }, [page]);
  return (
    <Card title={tr("سجل التدقيق (غير قابل للتعديل)", "Audit log (append-only)")} actions={<>
      <Btn small kind="ghost" disabled={!list.data?.length} onClick={() => downloadCsv("fazza-audit.csv", (list.data ?? []).map((a) => ({ id: a.id, at: a.created_at, actor: a.actor?.full_name ?? a.actor_id, action: a.action, target: `${a.target_type}:${a.target_id}`, details: JSON.stringify(a.details) })))}>⬇ CSV</Btn>
      <Btn small kind="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>‹</Btn>
      <Btn small kind="ghost" disabled={(list.data?.length ?? 0) < 100} onClick={() => setPage(page + 1)}>›</Btn></>}>
      {!list.data ? <Loader error={list.error} /> : list.data.length === 0 ? <Empty /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>{tr("الوقت", "Time")}</th><th>{tr("المنفذ", "Actor")}</th><th>{tr("الإجراء", "Action")}</th><th>{tr("الهدف", "Target")}</th><th>{tr("التفاصيل", "Details")}</th></tr></thead>
          <tbody>{list.data.map((a) => (
            <tr key={a.id}><td>{fmtDate(a.created_at)}</td><td>{a.actor?.full_name ?? "—"}</td><td><b>{a.action}</b></td><td className="num">{a.target_type}:{String(a.target_id ?? "").slice(0, 8)}</td>
              <td><code style={{ fontSize: 11 }}>{JSON.stringify(a.details).slice(0, 140)}</code></td></tr>))}</tbody>
        </table></div>
      )}
    </Card>
  );
}
