import { Badge, Btn, Card, Empty, Loader, toast, toastError, useLoad } from "../components";
import { rpc } from "../lib/api";
import { fmtDate, tr } from "../lib/i18n";
import { supabase } from "../lib/supabase";

export default function Ratings() {
  const list = useLoad(async () => {
    const { data, error } = await supabase.from("ratings").select("*, rater:profiles!ratings_rater_id_fkey(full_name), ratee:profiles!ratings_ratee_id_fkey(full_name)").order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return data;
  });
  return (
    <Card title={tr("التقييمات", "Ratings")}>
      {!list.data ? <Loader error={list.error} /> : list.data.length === 0 ? <Empty /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>★</th><th>{tr("التعليق", "Comment")}</th><th>{tr("من", "By")}</th><th>{tr("إلى", "For")}</th><th>{tr("التاريخ", "Date")}</th><th /></tr></thead>
          <tbody>{list.data.map((r) => (
            <tr key={r.id}>
              <td>{"★".repeat(r.stars)}</td><td>{r.comment ?? "—"}</td><td>{r.rater?.full_name ?? "—"}</td><td>{r.ratee?.full_name ?? "—"} <Badge>{r.ratee_role}</Badge></td><td>{fmtDate(r.created_at)}</td>
              <td><Btn small kind={r.hidden ? "success" : "ghost"} onClick={async () => {
                try { await rpc("admin_hide_rating", { p_rating: r.id, p_hidden: !r.hidden }); toast(tr("تم", "Done")); list.reload(); } catch (e) { toastError(e); }
              }}>{r.hidden ? tr("إظهار", "Restore") : tr("إخفاء", "Hide")}</Btn></td>
            </tr>))}</tbody>
        </table></div>
      )}
    </Card>
  );
}
