import { useState } from "react";
import { Badge, Btn, Card, Field, Loader, Modal, toast, toastError, useLoad } from "../components";
import { rpc } from "../lib/api";
import { tr } from "../lib/i18n";
import { supabase } from "../lib/supabase";

interface Area { id: number | null; governorate_id: number; name_ar: string; name_en: string; lat: number; lng: number; active: boolean }

export default function Areas() {
  const data = useLoad(async () => {
    const [g, a] = await Promise.all([supabase.from("governorates").select("*").order("sort"), supabase.from("areas").select("*").order("name_ar")]);
    return { gov: g.data ?? [], areas: (a.data ?? []) as Area[] };
  });
  const [edit, setEdit] = useState<Area | null>(null);
  const [q, setQ] = useState("");
  if (!data.data) return <Loader error={data.error} />;
  const { gov, areas } = data.data;
  const save = async () => {
    if (!edit) return;
    try {
      await rpc("admin_upsert_area", { p_id: edit.id, p_governorate: edit.governorate_id, p_name_ar: edit.name_ar, p_name_en: edit.name_en, p_lat: Number(edit.lat), p_lng: Number(edit.lng), p_active: edit.active });
      toast(tr("تم الحفظ", "Saved")); setEdit(null); data.reload();
    } catch (e) { toastError(e); }
  };
  return (
    <>
      <Card title={tr("المحافظات والمناطق", "Governorates & areas")} actions={<>
        <input placeholder={tr("بحث", "Search")} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} />
        <Btn onClick={() => setEdit({ id: null, governorate_id: gov[0]?.id ?? 1, name_ar: "", name_en: "", lat: 29.3375, lng: 47.9744, active: true })}>+ {tr("منطقة", "Area")}</Btn></>}>
        {gov.map((g) => (
          <details key={g.id} open={!!q}>
            <summary style={{ padding: "8px 0", cursor: "pointer" }}><b>{g.name_ar} · {g.name_en}</b> <Badge>{areas.filter((a) => a.governorate_id === g.id).length}</Badge></summary>
            <div className="row" style={{ padding: "6px 0 12px" }}>
              {areas.filter((a) => a.governorate_id === g.id && (!q || a.name_ar.includes(q) || a.name_en.toLowerCase().includes(q.toLowerCase()))).map((a) => (
                <Btn key={a.id} small kind={a.active ? "ghost" : "danger"} onClick={() => setEdit(a)}>{a.name_ar}</Btn>
              ))}
            </div>
          </details>
        ))}
      </Card>
      {edit ? (
        <Modal open title={edit.id ? edit.name_ar : tr("منطقة جديدة", "New area")} onClose={() => setEdit(null)} footer={<Btn onClick={save}>{tr("حفظ", "Save")}</Btn>}>
          <div className="form">
            <Field label={tr("المحافظة", "Governorate")}><select value={edit.governorate_id} onChange={(e) => setEdit({ ...edit, governorate_id: Number(e.target.value) })}>{gov.map((g) => <option key={g.id} value={g.id}>{g.name_ar}</option>)}</select></Field>
            <Field label={tr("الاسم بالعربية", "Arabic name")}><input value={edit.name_ar} onChange={(e) => setEdit({ ...edit, name_ar: e.target.value })} /></Field>
            <Field label={tr("الاسم بالإنجليزية", "English name")}><input value={edit.name_en} onChange={(e) => setEdit({ ...edit, name_en: e.target.value })} /></Field>
            <Field label="Lat"><input dir="ltr" value={edit.lat} onChange={(e) => setEdit({ ...edit, lat: e.target.value as unknown as number })} /></Field>
            <Field label="Lng"><input dir="ltr" value={edit.lng} onChange={(e) => setEdit({ ...edit, lng: e.target.value as unknown as number })} /></Field>
            <Field label={tr("مفعّلة", "Active")}><select value={edit.active ? "1" : "0"} onChange={(e) => setEdit({ ...edit, active: e.target.value === "1" })}><option value="1">✓</option><option value="0">✗</option></select></Field>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
