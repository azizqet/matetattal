import React, { useState } from 'react';
import { Empty, ErrorBox, Loading, Modal, fmtDate, q, supabase, useAction, useLoad } from '../lib';

const ICONS = ['car', 'motorcycle', 'gear', 'building', 'phone', 'tv', 'gamepad', 'sofa', 'appliance', 'watch', 'hanger', 'paw', 'excavator', 'tent', 'briefcase', 'wrench', 'store', 'spark', 'boat', 'grid'];

type Cat = { id: number; parent_id: number | null; slug: string; name_ar: string; name_en: string; icon: string; price_label: string; has_condition: boolean; sort: number; is_active: boolean; ads_count: number };
type Field = { id: number; category_id: number; key: string; label_ar: string; label_en: string; type: string; options: { v: string; ar: string; en: string }[]; unit_ar: string | null; unit_en: string | null; min_value: number | null; max_value: number | null; is_required: boolean; is_filterable: boolean; sort: number };

export function Categories() {
  const act = useAction();
  const cats = useLoad(async () => (await q(supabase.from('categories').select('*').order('sort'))) as Cat[], []);
  const [edit, setEdit] = useState<Partial<Cat> | null>(null);
  const [fieldsFor, setFieldsFor] = useState<Cat | null>(null);
  if (cats.loading) return <Loading />;
  if (cats.error) return <ErrorBox msg={cats.error} retry={cats.reload} />;
  const all = cats.data ?? [];
  const mains = all.filter((c) => !c.parent_id);

  const move = async (c: Cat, dir: -1 | 1) => {
    const sibs = all.filter((x) => x.parent_id === c.parent_id).sort((a, b) => a.sort - b.sort);
    const i = sibs.findIndex((x) => x.id === c.id); const j = i + dir;
    if (j < 0 || j >= sibs.length) return;
    [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
    await act(async () => { for (let k = 0; k < sibs.length; k++) if (sibs[k].sort !== k) await q(supabase.from('categories').update({ sort: k }).eq('id', sibs[k].id).select('id')); }, 'تم تحديث الترتيب');
    cats.reload();
  };
  const save = async () => {
    const e = edit!;
    const row = { parent_id: e.parent_id ?? null, slug: e.slug, name_ar: e.name_ar, name_en: e.name_en, icon: e.icon ?? 'grid', price_label: e.price_label ?? 'price', has_condition: e.has_condition ?? true, is_active: e.is_active ?? true, sort: e.sort ?? 99 };
    const ok = await act(() => q(e.id ? supabase.from('categories').update(row).eq('id', e.id).select('id') : supabase.from('categories').insert(row).select('id')), 'تم الحفظ');
    if (ok) { setEdit(null); cats.reload(); }
  };
  const remove = async (c: Cat) => {
    if (!confirm(`حذف «${c.name_ar}»؟ لا يمكن حذف قسم عليه إعلانات — عطّله بدلاً من ذلك.`)) return;
    if (await act(() => q(supabase.from('categories').delete().eq('id', c.id).select('id')), 'تم الحذف')) cats.reload();
  };
  const Row = ({ c, sub }: { c: Cat; sub?: boolean }) => (
    <div className={`tree-item ${sub ? 'sub' : ''}`}>
      <span style={{ flex: 1 }}><b>{c.name_ar}</b> <span className="faint">{c.name_en} · {c.slug} · {c.ads_count} إعلان</span> {!c.is_active && <span className="badge">معطّل</span>}</span>
      <button className="btn sec sm" onClick={() => move(c, -1)} aria-label="أعلى">▲</button>
      <button className="btn sec sm" onClick={() => move(c, 1)} aria-label="أسفل">▼</button>
      {!sub && <button className="btn sec sm" onClick={() => setFieldsFor(c)}>الحقول</button>}
      {!sub && <button className="btn sec sm" onClick={() => setEdit({ parent_id: c.id, icon: c.icon, has_condition: c.has_condition, price_label: c.price_label, is_active: true })}>+ فرعي</button>}
      <button className="btn sec sm" onClick={() => setEdit(c)}>تعديل</button>
      <button className="btn danger sm" onClick={() => remove(c)}>حذف</button>
    </div>
  );
  return (
    <>
      <div className="toolbar"><button className="btn" onClick={() => setEdit({ parent_id: null, icon: 'grid', has_condition: true, price_label: 'price', is_active: true })}>+ قسم رئيسي</button>
        <span className="faint">التغييرات تظهر في التطبيق فوراً دون تحديث.</span></div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {mains.map((m) => <React.Fragment key={m.id}><Row c={m} />{all.filter((s) => s.parent_id === m.id).sort((a, b) => a.sort - b.sort).map((s) => <Row key={s.id} c={s} sub />)}</React.Fragment>)}
      </div>
      {edit && (
        <Modal title={edit.id ? 'تعديل القسم' : edit.parent_id ? 'قسم فرعي جديد' : 'قسم رئيسي جديد'} onClose={() => setEdit(null)}
          footer={<><button className="btn sec" onClick={() => setEdit(null)}>إلغاء</button><button className="btn" disabled={!edit.name_ar || !edit.name_en || !edit.slug} onClick={save}>حفظ</button></>}>
          <div className="row">
            <label className="f">الاسم بالعربية<input className="input" value={edit.name_ar ?? ''} onChange={(e) => setEdit({ ...edit, name_ar: e.target.value })} /></label>
            <label className="f">الاسم بالإنجليزية<input className="input" dir="ltr" value={edit.name_en ?? ''} onChange={(e) => setEdit({ ...edit, name_en: e.target.value })} /></label>
            <label className="f">المعرّف (slug)<input className="input" dir="ltr" placeholder="cars-sale" value={edit.slug ?? ''} onChange={(e) => setEdit({ ...edit, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} /></label>
            <label className="f">الأيقونة<select className="input" value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })}>{ICONS.map((i) => <option key={i}>{i}</option>)}</select></label>
            <label className="f">نوع خانة السعر<select className="input" value={edit.price_label} onChange={(e) => setEdit({ ...edit, price_label: e.target.value })}>
              <option value="price">سعر</option><option value="rent">إيجار</option><option value="salary">راتب</option><option value="none">بدون</option></select></label>
            <label className="f">الترتيب<input className="input" type="number" value={edit.sort ?? 99} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={edit.has_condition ?? true} onChange={(e) => setEdit({ ...edit, has_condition: e.target.checked })} /> يطلب حالة المنتج (جديد/مستعمل)</label>{' '}
          <label className="check"><input type="checkbox" checked={edit.is_active ?? true} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> مفعّل</label>
        </Modal>
      )}
      {fieldsFor && <FieldsEditor cat={fieldsFor} onClose={() => setFieldsFor(null)} />}
    </>
  );
}

function FieldsEditor({ cat, onClose }: { cat: Cat; onClose: () => void }) {
  const act = useAction();
  const fields = useLoad(async () => (await q(supabase.from('category_fields').select('*').eq('category_id', cat.id).order('sort'))) as Field[], [cat.id]);
  const [f, setF] = useState<Partial<Field> | null>(null);
  const [optText, setOptText] = useState('');
  const save = async () => {
    const options = f!.type === 'select' ? optText.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0]).map(([v, ar, en]) => ({ v, ar: ar || v, en: en || ar || v })) : [];
    const row = { category_id: cat.id, key: f!.key, label_ar: f!.label_ar, label_en: f!.label_en, type: f!.type ?? 'text', options, unit_ar: f!.unit_ar || null, unit_en: f!.unit_en || null,
      min_value: f!.min_value ?? null, max_value: f!.max_value ?? null, is_required: !!f!.is_required, is_filterable: f!.is_filterable ?? true, sort: f!.sort ?? 99 };
    const ok = await act(() => q(f!.id ? supabase.from('category_fields').update(row).eq('id', f!.id).select('id') : supabase.from('category_fields').insert(row).select('id')), 'تم حفظ الحقل');
    if (ok) { setF(null); fields.reload(); }
  };
  return (
    <Modal title={`حقول «${cat.name_ar}»`} onClose={onClose} footer={<><button className="btn sec" onClick={onClose}>إغلاق</button><button className="btn" onClick={() => { setF({ type: 'select', is_filterable: true }); setOptText(''); }}>+ حقل</button></>}>
      <p className="faint">الحقول تظهر عند نشر الإعلان وفي الفلاتر، وتنطبق على كل الأقسام الفرعية.</p>
      {fields.loading ? <Loading /> : !fields.data?.length ? <Empty text="لا توجد حقول" /> : fields.data.map((x) => (
        <div key={x.id} className="tree-item">
          <span style={{ flex: 1 }}><b>{x.label_ar}</b> <span className="faint">{x.key} · {x.type}{x.is_required ? ' · إلزامي' : ''}{x.is_filterable ? ' · فلتر' : ''}{x.options.length ? ` · ${x.options.length} خيار` : ''}</span></span>
          <button className="btn sec sm" onClick={() => { setF(x); setOptText(x.options.map((o) => `${o.v} | ${o.ar} | ${o.en}`).join('\n')); }}>تعديل</button>
          <button className="btn danger sm" onClick={async () => { if (confirm('حذف الحقل؟') && await act(() => q(supabase.from('category_fields').delete().eq('id', x.id).select('id')), 'تم الحذف')) fields.reload(); }}>حذف</button>
        </div>
      ))}
      {f && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row">
            <label className="f">المفتاح<input className="input" dir="ltr" value={f.key ?? ''} onChange={(e) => setF({ ...f, key: e.target.value.toLowerCase().replace(/[^a-z_]/g, '') })} /></label>
            <label className="f">النوع<select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              <option value="select">قائمة خيارات</option><option value="text">نص</option><option value="number">رقم</option><option value="year">سنة</option></select></label>
            <label className="f">العنوان بالعربية<input className="input" value={f.label_ar ?? ''} onChange={(e) => setF({ ...f, label_ar: e.target.value })} /></label>
            <label className="f">العنوان بالإنجليزية<input className="input" dir="ltr" value={f.label_en ?? ''} onChange={(e) => setF({ ...f, label_en: e.target.value })} /></label>
            {(f.type === 'number' || f.type === 'year') && <>
              <label className="f">أقل قيمة<input className="input" type="number" value={f.min_value ?? ''} onChange={(e) => setF({ ...f, min_value: e.target.value === '' ? null : Number(e.target.value) })} /></label>
              <label className="f">أعلى قيمة<input className="input" type="number" value={f.max_value ?? ''} onChange={(e) => setF({ ...f, max_value: e.target.value === '' ? null : Number(e.target.value) })} /></label>
              <label className="f">الوحدة (عربي)<input className="input" value={f.unit_ar ?? ''} onChange={(e) => setF({ ...f, unit_ar: e.target.value })} /></label>
              <label className="f">الوحدة (إنجليزي)<input className="input" dir="ltr" value={f.unit_en ?? ''} onChange={(e) => setF({ ...f, unit_en: e.target.value })} /></label>
            </>}
          </div>
          {f.type === 'select' && <label className="f">الخيارات — سطر لكل خيار بصيغة: value | عربي | English
            <textarea className="input" dir="ltr" value={optText} onChange={(e) => setOptText(e.target.value)} placeholder={'toyota | تويوتا | Toyota'} /></label>}
          <label className="check"><input type="checkbox" checked={!!f.is_required} onChange={(e) => setF({ ...f, is_required: e.target.checked })} /> إلزامي</label>{' '}
          <label className="check"><input type="checkbox" checked={f.is_filterable ?? true} onChange={(e) => setF({ ...f, is_filterable: e.target.checked })} /> يظهر في الفلاتر</label>
          <footer style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn sec" onClick={() => setF(null)}>إلغاء</button><button className="btn" disabled={!f.key || !f.label_ar || !f.label_en} onClick={save}>حفظ الحقل</button>
          </footer>
        </div>
      )}
    </Modal>
  );
}

// ══════════════════════════ Locations ════════════════════════════════════
type Gov = { id: number; slug: string; name_ar: string; name_en: string; lat: number; lng: number; sort: number; is_active: boolean };
type Area = { id: number; governorate_id: number; name_ar: string; name_en: string; sort: number; is_active: boolean };

export function Locations() {
  const act = useAction();
  const data = useLoad(async () => ({
    govs: (await q(supabase.from('governorates').select('*').order('sort'))) as Gov[],
    areas: (await q(supabase.from('areas').select('*').order('sort'))) as Area[],
  }), []);
  const [gov, setGov] = useState<number | null>(null);
  const [edit, setEdit] = useState<Partial<Area> | null>(null);
  const [editGov, setEditGov] = useState<Partial<Gov> | null>(null);
  if (data.loading) return <Loading />;
  if (data.error || !data.data) return <ErrorBox msg={data.error ?? ''} retry={data.reload} />;
  const g = gov ?? data.data.govs[0]?.id;
  const areas = data.data.areas.filter((a) => a.governorate_id === g);
  return (
    <>
      <div className="toolbar chips">
        {data.data.govs.map((x) => <button key={x.id} className={`chip ${g === x.id ? 'on' : ''}`} onClick={() => setGov(x.id)}>{x.name_ar} ({data.data!.areas.filter((a) => a.governorate_id === x.id).length}){!x.is_active ? ' · معطّلة' : ''}</button>)}
        <button className="btn sec sm" onClick={() => setEditGov({ is_active: true, sort: 99, lat: 29.3, lng: 47.9 })}>+ محافظة</button>
        {g && <button className="btn sec sm" onClick={() => setEditGov(data.data!.govs.find((x) => x.id === g)!)}>تعديل المحافظة</button>}
        <button className="btn sm" onClick={() => setEdit({ governorate_id: g, is_active: true, sort: areas.length })}>+ منطقة</button>
      </div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>المنطقة</th><th>English</th><th>الترتيب</th><th>الحالة</th><th></th></tr></thead>
        <tbody>{areas.map((a) => (
          <tr key={a.id}><td>{a.name_ar}</td><td dir="ltr">{a.name_en}</td><td>{a.sort}</td><td>{a.is_active ? <span className="badge active">مفعّلة</span> : <span className="badge">معطّلة</span>}</td>
            <td><div className="actions">
              <button className="btn sec sm" onClick={() => setEdit(a)}>تعديل</button>
              <button className="btn sec sm" onClick={() => act(() => q(supabase.from('areas').update({ is_active: !a.is_active }).eq('id', a.id).select('id'))).then(data.reload)}>{a.is_active ? 'تعطيل' : 'تفعيل'}</button>
            </div></td></tr>
        ))}</tbody>
      </table></div>
      {edit && (
        <Modal title={edit.id ? 'تعديل منطقة' : 'منطقة جديدة'} onClose={() => setEdit(null)}
          footer={<><button className="btn sec" onClick={() => setEdit(null)}>إلغاء</button><button className="btn" disabled={!edit.name_ar || !edit.name_en} onClick={async () => {
            const row = { governorate_id: edit.governorate_id, name_ar: edit.name_ar, name_en: edit.name_en, sort: edit.sort ?? 0, is_active: edit.is_active ?? true };
            if (await act(() => q(edit.id ? supabase.from('areas').update(row).eq('id', edit.id).select('id') : supabase.from('areas').insert(row).select('id')), 'تم الحفظ')) { setEdit(null); data.reload(); }
          }}>حفظ</button></>}>
          <div className="row">
            <label className="f">الاسم بالعربية<input className="input" value={edit.name_ar ?? ''} onChange={(e) => setEdit({ ...edit, name_ar: e.target.value })} /></label>
            <label className="f">الاسم بالإنجليزية<input className="input" dir="ltr" value={edit.name_en ?? ''} onChange={(e) => setEdit({ ...edit, name_en: e.target.value })} /></label>
            <label className="f">المحافظة<select className="input" value={edit.governorate_id} onChange={(e) => setEdit({ ...edit, governorate_id: Number(e.target.value) })}>{data.data.govs.map((x) => <option key={x.id} value={x.id}>{x.name_ar}</option>)}</select></label>
            <label className="f">الترتيب<input className="input" type="number" value={edit.sort ?? 0} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} /></label>
          </div>
        </Modal>
      )}
      {editGov && (
        <Modal title={editGov.id ? 'تعديل محافظة' : 'محافظة جديدة'} onClose={() => setEditGov(null)}
          footer={<><button className="btn sec" onClick={() => setEditGov(null)}>إلغاء</button><button className="btn" disabled={!editGov.name_ar || !editGov.name_en || !editGov.slug} onClick={async () => {
            const row = { slug: editGov.slug, name_ar: editGov.name_ar, name_en: editGov.name_en, lat: editGov.lat, lng: editGov.lng, sort: editGov.sort ?? 99, is_active: editGov.is_active ?? true };
            if (await act(() => q(editGov.id ? supabase.from('governorates').update(row).eq('id', editGov.id).select('id') : supabase.from('governorates').insert(row).select('id')), 'تم الحفظ')) { setEditGov(null); data.reload(); }
          }}>حفظ</button></>}>
          <div className="row">
            <label className="f">الاسم بالعربية<input className="input" value={editGov.name_ar ?? ''} onChange={(e) => setEditGov({ ...editGov, name_ar: e.target.value })} /></label>
            <label className="f">الاسم بالإنجليزية<input className="input" dir="ltr" value={editGov.name_en ?? ''} onChange={(e) => setEditGov({ ...editGov, name_en: e.target.value })} /></label>
            <label className="f">المعرّف<input className="input" dir="ltr" value={editGov.slug ?? ''} onChange={(e) => setEditGov({ ...editGov, slug: e.target.value.toLowerCase().replace(/[^a-z-]/g, '') })} /></label>
            <label className="f">خط العرض (المركز)<input className="input" type="number" step="0.0001" value={editGov.lat ?? ''} onChange={(e) => setEditGov({ ...editGov, lat: Number(e.target.value) })} /></label>
            <label className="f">خط الطول (المركز)<input className="input" type="number" step="0.0001" value={editGov.lng ?? ''} onChange={(e) => setEditGov({ ...editGov, lng: Number(e.target.value) })} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={editGov.is_active ?? true} onChange={(e) => setEditGov({ ...editGov, is_active: e.target.checked })} /> مفعّلة</label>
        </Modal>
      )}
    </>
  );
}

// ══════════════════════════ Legal pages ══════════════════════════════════
type PageRow = { slug: string; title_ar: string; title_en: string; body_ar: string; body_en: string; updated_at: string };
export function Pages() {
  const act = useAction();
  const pages = useLoad(async () => (await q(supabase.from('pages').select('*').order('slug'))) as PageRow[], []);
  const [edit, setEdit] = useState<PageRow | null>(null);
  if (pages.loading) return <Loading />;
  if (pages.error) return <ErrorBox msg={pages.error} retry={pages.reload} />;
  return (
    <>
      <div className="grid two">{(pages.data ?? []).map((p) => (
        <div key={p.slug} className="card"><h2>{p.title_ar}</h2><div className="faint">آخر تحديث {fmtDate(p.updated_at)}</div>
          <button className="btn sec sm" style={{ marginTop: 10 }} onClick={() => setEdit(p)}>تعديل</button></div>
      ))}</div>
      {edit && (
        <Modal title={`تعديل: ${edit.title_ar}`} onClose={() => setEdit(null)}
          footer={<><button className="btn sec" onClick={() => setEdit(null)}>إلغاء</button><button className="btn" onClick={async () => {
            if (await act(() => q(supabase.from('pages').update({ title_ar: edit.title_ar, title_en: edit.title_en, body_ar: edit.body_ar, body_en: edit.body_en }).eq('slug', edit.slug).select('slug')), 'تم الحفظ')) { setEdit(null); pages.reload(); }
          }}>حفظ</button></>}>
          <p className="faint">صيغة Markdown بسيطة: ## عنوان، - نقطة.</p>
          <label className="f">العنوان بالعربية<input className="input" value={edit.title_ar} onChange={(e) => setEdit({ ...edit, title_ar: e.target.value })} /></label>
          <label className="f">النص بالعربية<textarea className="input" style={{ minHeight: 220 }} value={edit.body_ar} onChange={(e) => setEdit({ ...edit, body_ar: e.target.value })} /></label>
          <label className="f">Title (English)<input className="input" dir="ltr" value={edit.title_en} onChange={(e) => setEdit({ ...edit, title_en: e.target.value })} /></label>
          <label className="f">Body (English)<textarea className="input" dir="ltr" style={{ minHeight: 220 }} value={edit.body_en} onChange={(e) => setEdit({ ...edit, body_en: e.target.value })} /></label>
        </Modal>
      )}
    </>
  );
}

// ══════════════════════════ Settings ═════════════════════════════════════
type Setting = { key: string; value: unknown; description: string | null; updated_at: string };
export function Settings() {
  const act = useAction();
  const s = useLoad(async () => (await q(supabase.from('app_settings').select('*').order('key'))) as Setting[], []);
  const [draft, setDraft] = useState<Record<string, string>>({});
  if (s.loading) return <Loading />;
  if (s.error) return <ErrorBox msg={s.error} retry={s.reload} />;
  const saveOne = async (row: Setting) => {
    const raw = draft[row.key];
    let value: unknown = raw;
    if (typeof row.value === 'number') value = Number(raw);
    if (typeof row.value === 'boolean') value = raw === 'true';
    if (row.key === 'payments_enabled' && value === true && !confirm('تفعيل المدفوعات يتطلب ربط بوابة دفع متوافقة مع سياسات Apple وGoogle. متأكد؟')) return;
    if (await act(() => q(supabase.from('app_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', row.key).select('key')), 'تم حفظ الإعداد')) {
      setDraft((d) => { const n = { ...d }; delete n[row.key]; return n; }); s.reload();
    }
  };
  return (
    <div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>الإعداد</th><th>القيمة</th><th></th></tr></thead>
      <tbody>{(s.data ?? []).map((row) => {
        const cur = draft[row.key] ?? String(row.value ?? '');
        return (
          <tr key={row.key}>
            <td><b>{row.description ?? row.key}</b><div className="faint" dir="ltr">{row.key}</div></td>
            <td>{typeof row.value === 'boolean'
              ? <select className="input" value={cur} onChange={(e) => setDraft({ ...draft, [row.key]: e.target.value })}><option value="true">مفعّل</option><option value="false">معطّل</option></select>
              : <input className="input" type={typeof row.value === 'number' ? 'number' : 'text'} value={cur} onChange={(e) => setDraft({ ...draft, [row.key]: e.target.value })} />}</td>
            <td>{draft[row.key] !== undefined && <button className="btn sm" onClick={() => saveOne(row)}>حفظ</button>}</td>
          </tr>
        );
      })}</tbody>
    </table></div>
  );
}
