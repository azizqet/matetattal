import { useState } from 'react';
import { Empty, ErrorBox, Loading, Modal, Status, fmtDate, fmtKwd, publicUrl, q, supabase, useAction, useLoad } from '../lib';

const KINDS: Record<string, string> = { feature: 'إعلان مميز', pin: 'تثبيت بالأعلى', bump: 'رفع للأعلى', merchant: 'باقة تاجر', subscription: 'اشتراك شهري' };

// ══════════════════════════ Packages & promo codes ═══════════════════════
type Pkg = { id: number; kind: string; name_ar: string; name_en: string; description_ar: string; description_en: string; price_kwd: number; promo_price_kwd: number | null; promo_ends_at: string | null; duration_days: number; ads_quota: number | null; bumps_quota: number | null; is_active: boolean; sort: number };
type Promo = { id: number; code: string; discount_percent: number | null; discount_kwd: number | null; package_kind: string | null; starts_at: string; ends_at: string | null; max_uses: number | null; used_count: number; is_active: boolean };

export function Commerce() {
  const act = useAction();
  const data = useLoad(async () => ({
    pkgs: (await q(supabase.from('packages').select('*').order('sort'))) as Pkg[],
    promos: (await q(supabase.from('promo_codes').select('*').order('created_at', { ascending: false }))) as Promo[],
    payments: ((await q(supabase.from('app_settings').select('value').eq('key', 'payments_enabled').maybeSingle())) as { value: boolean } | null)?.value ?? false,
  }), []);
  const [pkg, setPkg] = useState<Partial<Pkg> | null>(null);
  const [promo, setPromo] = useState<Partial<Promo> | null>(null);
  if (data.loading) return <Loading />;
  if (data.error || !data.data) return <ErrorBox msg={data.error ?? ''} retry={data.reload} />;
  const savePkg = async () => {
    const p = pkg!;
    const row = { kind: p.kind ?? 'feature', name_ar: p.name_ar, name_en: p.name_en, description_ar: p.description_ar ?? '', description_en: p.description_en ?? '', price_kwd: Number(p.price_kwd ?? 0),
      promo_price_kwd: p.promo_price_kwd === null || p.promo_price_kwd === undefined || String(p.promo_price_kwd) === '' ? null : Number(p.promo_price_kwd),
      promo_ends_at: p.promo_ends_at || null, duration_days: Number(p.duration_days ?? 7), ads_quota: p.ads_quota || null, bumps_quota: p.bumps_quota ?? null, is_active: p.is_active ?? false, sort: p.sort ?? 99 };
    if (await act(() => q(p.id ? supabase.from('packages').update(row).eq('id', p.id).select('id') : supabase.from('packages').insert(row).select('id')), 'تم الحفظ')) { setPkg(null); data.reload(); }
  };
  const savePromo = async () => {
    const p = promo!;
    const row = { code: (p.code ?? '').toUpperCase(), discount_percent: p.discount_percent || null, discount_kwd: p.discount_kwd || null, package_kind: p.package_kind || null,
      ends_at: p.ends_at || null, max_uses: p.max_uses || null, is_active: p.is_active ?? true };
    if (await act(() => q(p.id ? supabase.from('promo_codes').update(row).eq('id', p.id).select('id') : supabase.from('promo_codes').insert(row).select('id')), 'تم الحفظ')) { setPromo(null); data.reload(); }
  };
  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="card" style={{ background: 'var(--accent-soft)' }}>
        <b>حالة المدفوعات: {data.data.payments ? 'مفعّلة' : 'معطّلة'}</b>
        <div className="muted">نشر الإعلانات العادية مجاني. لا تُفعَّل الرسوم الحقيقية قبل ربط وسيلة دفع متوافقة (المزايا الرقمية داخل التطبيق تتطلب الشراء داخل التطبيق من Apple وGoogle). حتى ذلك الحين يمكن تمييز الإعلانات يدوياً وتسجيل المبيعات اليدوية للشركات.</div>
      </div>
      <div className="card">
        <div className="toolbar"><h2 style={{ flex: 1, margin: 0 }}>الباقات والأسعار</h2><button className="btn" onClick={() => setPkg({ kind: 'feature', duration_days: 7, is_active: false })}>+ باقة</button></div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>الباقة</th><th>النوع</th><th>السعر</th><th>عرض موسمي</th><th>المدة</th><th>الحالة</th><th></th></tr></thead>
          <tbody>{data.data.pkgs.map((p) => (
            <tr key={p.id}><td><b>{p.name_ar}</b><div className="faint">{p.description_ar}</div></td><td>{KINDS[p.kind]}</td><td>{fmtKwd(p.price_kwd)}</td>
              <td>{p.promo_price_kwd !== null ? `${fmtKwd(p.promo_price_kwd)} حتى ${fmtDate(p.promo_ends_at)}` : '—'}</td><td>{p.duration_days} يوم</td>
              <td>{p.is_active ? <span className="badge active">ظاهرة</span> : <span className="badge">مخفية</span>}</td>
              <td><button className="btn sec sm" onClick={() => setPkg(p)}>تعديل</button></td></tr>
          ))}</tbody>
        </table></div>
      </div>
      <div className="card">
        <div className="toolbar"><h2 style={{ flex: 1, margin: 0 }}>أكواد الخصم</h2><button className="btn" onClick={() => setPromo({ is_active: true })}>+ كود</button></div>
        {!data.data.promos.length ? <Empty text="لا توجد أكواد" /> : <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>الكود</th><th>الخصم</th><th>الباقة</th><th>الاستخدام</th><th>ينتهي</th><th>الحالة</th><th></th></tr></thead>
          <tbody>{data.data.promos.map((p) => (
            <tr key={p.id}><td dir="ltr"><b>{p.code}</b></td><td>{p.discount_percent ? `${p.discount_percent}%` : fmtKwd(p.discount_kwd)}</td><td>{p.package_kind ? KINDS[p.package_kind] : 'الكل'}</td>
              <td>{p.used_count}{p.max_uses ? ` / ${p.max_uses}` : ''}</td><td className="faint">{fmtDate(p.ends_at)}</td>
              <td>{p.is_active ? <span className="badge active">فعّال</span> : <span className="badge">موقوف</span>}</td>
              <td><button className="btn sec sm" onClick={() => setPromo(p)}>تعديل</button></td></tr>
          ))}</tbody>
        </table></div>}
      </div>
      {pkg && (
        <Modal title={pkg.id ? 'تعديل باقة' : 'باقة جديدة'} onClose={() => setPkg(null)} footer={<><button className="btn sec" onClick={() => setPkg(null)}>إلغاء</button><button className="btn" disabled={!pkg.name_ar || !pkg.name_en} onClick={savePkg}>حفظ</button></>}>
          <div className="row">
            <label className="f">النوع<select className="input" value={pkg.kind} onChange={(e) => setPkg({ ...pkg, kind: e.target.value })}>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="f">السعر (د.ك)<input className="input" type="number" step="0.001" min={0} value={pkg.price_kwd ?? ''} onChange={(e) => setPkg({ ...pkg, price_kwd: Number(e.target.value) })} /></label>
            <label className="f">الاسم بالعربية<input className="input" value={pkg.name_ar ?? ''} onChange={(e) => setPkg({ ...pkg, name_ar: e.target.value })} /></label>
            <label className="f">الاسم بالإنجليزية<input className="input" dir="ltr" value={pkg.name_en ?? ''} onChange={(e) => setPkg({ ...pkg, name_en: e.target.value })} /></label>
            <label className="f">الوصف بالعربية<input className="input" value={pkg.description_ar ?? ''} onChange={(e) => setPkg({ ...pkg, description_ar: e.target.value })} /></label>
            <label className="f">الوصف بالإنجليزية<input className="input" dir="ltr" value={pkg.description_en ?? ''} onChange={(e) => setPkg({ ...pkg, description_en: e.target.value })} /></label>
            <label className="f">المدة (أيام)<input className="input" type="number" min={1} value={pkg.duration_days ?? 7} onChange={(e) => setPkg({ ...pkg, duration_days: Number(e.target.value) })} /></label>
            <label className="f">حصة الإعلانات<input className="input" type="number" value={pkg.ads_quota ?? ''} onChange={(e) => setPkg({ ...pkg, ads_quota: e.target.value ? Number(e.target.value) : null })} /></label>
            <label className="f">سعر العرض الموسمي<input className="input" type="number" step="0.001" value={pkg.promo_price_kwd ?? ''} onChange={(e) => setPkg({ ...pkg, promo_price_kwd: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <label className="f">ينتهي العرض<input className="input" type="datetime-local" value={pkg.promo_ends_at?.slice(0, 16) ?? ''} onChange={(e) => setPkg({ ...pkg, promo_ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={pkg.is_active ?? false} onChange={(e) => setPkg({ ...pkg, is_active: e.target.checked })} /> ظاهرة في التطبيق</label>
        </Modal>
      )}
      {promo && (
        <Modal title={promo.id ? 'تعديل كود' : 'كود خصم جديد'} onClose={() => setPromo(null)} footer={<><button className="btn sec" onClick={() => setPromo(null)}>إلغاء</button><button className="btn" disabled={!promo.code || (!promo.discount_percent && !promo.discount_kwd)} onClick={savePromo}>حفظ</button></>}>
          <div className="row">
            <label className="f">الكود<input className="input" dir="ltr" value={promo.code ?? ''} onChange={(e) => setPromo({ ...promo, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} /></label>
            <label className="f">نسبة الخصم %<input className="input" type="number" min={1} max={100} value={promo.discount_percent ?? ''} onChange={(e) => setPromo({ ...promo, discount_percent: e.target.value ? Number(e.target.value) : null })} /></label>
            <label className="f">أو مبلغ ثابت (د.ك)<input className="input" type="number" step="0.001" value={promo.discount_kwd ?? ''} onChange={(e) => setPromo({ ...promo, discount_kwd: e.target.value ? Number(e.target.value) : null })} /></label>
            <label className="f">لباقة محددة<select className="input" value={promo.package_kind ?? ''} onChange={(e) => setPromo({ ...promo, package_kind: e.target.value || null })}><option value="">الكل</option>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="f">أقصى استخدام<input className="input" type="number" value={promo.max_uses ?? ''} onChange={(e) => setPromo({ ...promo, max_uses: e.target.value ? Number(e.target.value) : null })} /></label>
            <label className="f">ينتهي في<input className="input" type="datetime-local" value={promo.ends_at?.slice(0, 16) ?? ''} onChange={(e) => setPromo({ ...promo, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={promo.is_active ?? true} onChange={(e) => setPromo({ ...promo, is_active: e.target.checked })} /> فعّال</label>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════ Banners ══════════════════════════════════════
type Banner = { id: number; placement: string; category_id: number | null; title: string; advertiser: string | null; image_path: string; link_url: string | null; starts_at: string; ends_at: string | null; is_active: boolean; sort: number; impressions: number; clicks: number };
const PLACES: Record<string, string> = { home_top: 'الرئيسية — أعلى', home_middle: 'الرئيسية — وسط', category_top: 'أعلى القسم', search_top: 'أعلى البحث' };

export function Banners() {
  const act = useAction();
  const list = useLoad(async () => ({
    banners: (await q(supabase.from('banners').select('*').order('placement').order('sort'))) as Banner[],
    cats: (await q(supabase.from('categories').select('id,name_ar').is('parent_id', null).order('sort'))) as { id: number; name_ar: string }[],
  }), []);
  const [edit, setEdit] = useState<Partial<Banner> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  if (list.loading) return <Loading />;
  if (list.error || !list.data) return <ErrorBox msg={list.error ?? ''} retry={list.reload} />;
  const save = async () => {
    const b = edit!;
    const ok = await act(async () => {
      let image_path = b.image_path;
      if (file) {
        if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 4 * 1024 * 1024) throw new Error('الصورة يجب أن تكون JPG/PNG/WebP وأقل من 4MB');
        image_path = `${crypto.randomUUID()}.${file.type.split('/')[1].replace('jpeg', 'jpg')}`;
        const { error } = await supabase.storage.from('banners').upload(image_path, file, { contentType: file.type, cacheControl: '31536000' });
        if (error) throw error;
      }
      if (!image_path) throw new Error('اختر صورة البنر (النسبة المقترحة 2.35:1)');
      const row = { placement: b.placement ?? 'home_top', category_id: b.placement === 'category_top' ? b.category_id ?? null : null, title: b.title, advertiser: b.advertiser || null, image_path,
        link_url: b.link_url || null, starts_at: b.starts_at ?? new Date().toISOString(), ends_at: b.ends_at || null, is_active: b.is_active ?? true, sort: b.sort ?? 0 };
      await q(b.id ? supabase.from('banners').update(row).eq('id', b.id).select('id') : supabase.from('banners').insert(row).select('id'));
    }, 'تم حفظ البنر');
    if (ok) { setEdit(null); setFile(null); list.reload(); }
  };
  return (
    <>
      <div className="toolbar"><button className="btn" onClick={() => { setEdit({ placement: 'home_top', is_active: true }); setFile(null); }}>+ بنر</button><span className="faint">المقاس المقترح 1410×600 بكسل.</span></div>
      {!list.data.banners.length ? <Empty text="لا توجد بنرات" /> : <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th></th><th>العنوان</th><th>المكان</th><th>المدة</th><th>ظهور / نقرات</th><th>الحالة</th><th></th></tr></thead>
        <tbody>{list.data.banners.map((b) => (
          <tr key={b.id}><td><img src={publicUrl('banners', b.image_path)} alt="" style={{ width: 120, borderRadius: 10 }} /></td>
            <td><b>{b.title}</b><div className="faint">{b.advertiser}</div></td><td>{PLACES[b.placement]}</td>
            <td className="faint">{fmtDate(b.starts_at)} ← {fmtDate(b.ends_at)}</td><td>{b.impressions} / {b.clicks}</td>
            <td>{b.is_active ? <span className="badge active">فعّال</span> : <span className="badge">موقوف</span>}</td>
            <td><div className="actions"><button className="btn sec sm" onClick={() => { setEdit(b); setFile(null); }}>تعديل</button>
              <button className="btn danger sm" onClick={async () => { if (confirm('حذف البنر؟') && await act(async () => { await q(supabase.from('banners').delete().eq('id', b.id).select('id')); await supabase.storage.from('banners').remove([b.image_path]); }, 'تم الحذف')) list.reload(); }}>حذف</button></div></td></tr>
        ))}</tbody>
      </table></div>}
      {edit && (
        <Modal title={edit.id ? 'تعديل بنر' : 'بنر جديد'} onClose={() => setEdit(null)} footer={<><button className="btn sec" onClick={() => setEdit(null)}>إلغاء</button><button className="btn" disabled={!edit.title} onClick={save}>حفظ</button></>}>
          <div className="row">
            <label className="f">العنوان<input className="input" value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
            <label className="f">المعلن<input className="input" value={edit.advertiser ?? ''} onChange={(e) => setEdit({ ...edit, advertiser: e.target.value })} /></label>
            <label className="f">المكان<select className="input" value={edit.placement} onChange={(e) => setEdit({ ...edit, placement: e.target.value })}>{Object.entries(PLACES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            {edit.placement === 'category_top' && <label className="f">القسم<select className="input" value={edit.category_id ?? ''} onChange={(e) => setEdit({ ...edit, category_id: e.target.value ? Number(e.target.value) : null })}><option value="">كل الأقسام</option>{list.data!.cats.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}</select></label>}
            <label className="f">الرابط (https:// أو fikrasell://)<input className="input" dir="ltr" value={edit.link_url ?? ''} onChange={(e) => setEdit({ ...edit, link_url: e.target.value })} /></label>
            <label className="f">الترتيب<input className="input" type="number" value={edit.sort ?? 0} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} /></label>
            <label className="f">يبدأ<input className="input" type="datetime-local" value={edit.starts_at?.slice(0, 16) ?? ''} onChange={(e) => setEdit({ ...edit, starts_at: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /></label>
            <label className="f">ينتهي<input className="input" type="datetime-local" value={edit.ends_at?.slice(0, 16) ?? ''} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
          </div>
          <label className="f">الصورة<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <label className="check" style={{ marginTop: 8 }}><input type="checkbox" checked={edit.is_active ?? true} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> فعّال</label>
        </Modal>
      )}
    </>
  );
}

// ══════════════════════════ Broadcast notifications ══════════════════════
const AUDIENCES: Record<string, string> = { all: 'جميع المستخدمين', merchants: 'التجار', new_users: 'المستخدمون الجدد (30 يوماً)', active_sellers: 'من لديهم إعلانات نشطة', inactive: 'غير النشطين (30 يوماً)' };
export function Broadcasts() {
  const act = useAction();
  const hist = useLoad(async () => (await q(supabase.from('broadcasts').select('*').order('created_at', { ascending: false }).limit(50))) as { id: number; audience: string; title_ar: string; recipients: number; created_at: string }[], []);
  const [f, setF] = useState({ audience: 'all', title_ar: '', title_en: '', body_ar: '', body_en: '', link: '' });
  const ready = f.title_ar && f.title_en && f.body_ar && f.body_en;
  return (
    <div className="grid two">
      <div className="card">
        <h2>إشعار جديد</h2>
        <div className="row" style={{ display: 'grid', gap: 10 }}>
          <label className="f">الفئة<select className="input" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>{Object.entries(AUDIENCES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="f">العنوان بالعربية<input className="input" maxLength={80} value={f.title_ar} onChange={(e) => setF({ ...f, title_ar: e.target.value })} /></label>
          <label className="f">النص بالعربية<textarea className="input" maxLength={300} value={f.body_ar} onChange={(e) => setF({ ...f, body_ar: e.target.value })} /></label>
          <label className="f">Title (English)<input className="input" dir="ltr" maxLength={80} value={f.title_en} onChange={(e) => setF({ ...f, title_en: e.target.value })} /></label>
          <label className="f">Body (English)<textarea className="input" dir="ltr" maxLength={300} value={f.body_en} onChange={(e) => setF({ ...f, body_en: e.target.value })} /></label>
          <label className="f">رابط (اختياري)<input className="input" dir="ltr" placeholder="fikrasell://category/cars" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></label>
          <button className="btn" disabled={!ready} onClick={async () => {
            if (!confirm(`إرسال إلى: ${AUDIENCES[f.audience]}؟`)) return;
            let n = 0;
            const ok = await act(async () => { n = (await q(supabase.rpc('admin_broadcast', { p_audience: f.audience, p_title_ar: f.title_ar, p_title_en: f.title_en, p_body_ar: f.body_ar, p_body_en: f.body_en, p_link: f.link || null }))) as number; }, 'تم الإرسال');
            if (ok) { alert(`وصل الإشعار إلى ${n} مستخدم (داخل التطبيق + الإشعارات الفورية لمن فعّلها).`); setF({ ...f, title_ar: '', title_en: '', body_ar: '', body_en: '', link: '' }); hist.reload(); }
          }}>إرسال</button>
          <div className="faint">يحترم الإرسال إعدادات كل مستخدم (التنبيهات العامة).</div>
        </div>
      </div>
      <div className="card">
        <h2>السجل</h2>
        {hist.loading ? <Loading /> : !hist.data?.length ? <Empty /> : hist.data.map((b) => (
          <div key={b.id} className="tree-item"><span style={{ flex: 1 }}><b>{b.title_ar}</b><div className="faint">{AUDIENCES[b.audience]} · {b.recipients} مستلم</div></span><span className="faint">{fmtDate(b.created_at)}</span></div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════ Support ══════════════════════════════════════
type Ticket = { id: number; subject: string; status: string; created_at: string; updated_at: string; user_id: string; profiles: { full_name: string } | null };
export function Support() {
  const act = useAction();
  const [status, setStatus] = useState('open');
  const [open, setOpen] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');
  const list = useLoad(async () => (await q(supabase.from('support_tickets').select('*, profiles!support_tickets_user_id_fkey(full_name)').eq('status', status).order('updated_at', { ascending: false }).limit(100))) as unknown as Ticket[], [status]);
  const msgs = useLoad(async () => (open ? ((await q(supabase.from('ticket_messages').select('*').eq('ticket_id', open.id).order('created_at'))) as { id: number; is_staff: boolean; body: string; created_at: string }[]) : []), [open?.id]);
  return (
    <>
      <div className="toolbar chips">{[['open', 'مفتوحة'], ['pending', 'بانتظار العميل'], ['closed', 'مغلقة']].map(([v, l]) => <button key={v} className={`chip ${status === v ? 'on' : ''}`} onClick={() => setStatus(v)}>{l}</button>)}</div>
      {list.loading ? <Loading /> : list.error ? <ErrorBox msg={list.error} retry={list.reload} /> : !list.data?.length ? <Empty text="لا توجد طلبات" /> : (
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>#</th><th>الموضوع</th><th>المستخدم</th><th>آخر تحديث</th><th></th></tr></thead>
          <tbody>{list.data.map((t) => <tr key={t.id}><td>{t.id}</td><td>{t.subject}</td><td>{t.profiles?.full_name}</td><td className="faint">{fmtDate(t.updated_at)}</td><td><button className="btn sec sm" onClick={() => { setOpen(t); setReply(''); }}>فتح</button></td></tr>)}</tbody>
        </table></div>
      )}
      {open && (
        <Modal title={`#${open.id} · ${open.subject}`} onClose={() => setOpen(null)}
          footer={<>
            {open.status !== 'closed' && <button className="btn sec" onClick={() => act(() => q(supabase.from('support_tickets').update({ status: 'closed' }).eq('id', open.id).select('id')), 'تم الإغلاق').then(() => { setOpen(null); list.reload(); })}>إغلاق الطلب</button>}
            <button className="btn" disabled={!reply.trim()} onClick={() => act(() => q(supabase.from('ticket_messages').insert({ ticket_id: open.id, body: reply.trim() }).select('id')), 'تم إرسال الرد').then(() => { setReply(''); msgs.reload(); list.reload(); })}>إرسال الرد</button>
          </>}>
          <div style={{ maxHeight: 300, overflow: 'auto', marginBottom: 12 }}>
            {(msgs.data ?? []).map((m) => <div key={m.id} className="card" style={{ marginBottom: 8, background: m.is_staff ? 'var(--primary-soft)' : 'var(--surface)' }}><div className="faint">{m.is_staff ? 'الدعم' : open.profiles?.full_name} · {fmtDate(m.created_at)}</div><div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div></div>)}
          </div>
          <textarea className="input" placeholder="اكتب الرد…" value={reply} onChange={(e) => setReply(e.target.value)} />
        </Modal>
      )}
    </>
  );
}

// ══════════════════════════ Revenue ══════════════════════════════════════
type Rev = { total_kwd: number; by_month: { month: string; kwd: number; orders: number }[]; by_kind: { kind: string; kwd: number; orders: number }[]; recent: { id: string; amount_kwd: number; status: string; provider: string | null; created_at: string; full_name: string; package: string }[] };
export function Revenue() {
  const act = useAction();
  const r = useLoad(async () => (await q(supabase.rpc('admin_revenue'))) as Rev, []);
  const [grant, setGrant] = useState<{ email: string; pkg: number | ''; ad: string; amount: string; note: string } | null>(null);
  const pkgs = useLoad(async () => (await q(supabase.from('packages').select('id,name_ar').order('sort'))) as { id: number; name_ar: string }[], []);
  if (r.loading) return <Loading />;
  if (r.error || !r.data) return <ErrorBox msg={r.error ?? ''} retry={r.reload} />;
  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="grid kpis">
        <div className="card kpi"><div className="bar" /><div className="v">{fmtKwd(r.data.total_kwd)}</div><div className="l">إجمالي الإيرادات</div></div>
        {r.data.by_kind.map((k) => <div key={k.kind} className="card kpi"><div className="bar" /><div className="v">{fmtKwd(k.kwd)}</div><div className="l">{KINDS[k.kind]} · {k.orders} طلب</div></div>)}
      </div>
      <div className="toolbar"><button className="btn" onClick={() => setGrant({ email: '', pkg: '', ad: '', amount: '', note: '' })}>تسجيل بيع يدوي</button><span className="faint">للباقات التي تُباع للشركات خارج التطبيق (تحويل بنكي/فاتورة).</span></div>
      <div className="grid two">
        <div className="card"><h2>حسب الشهر</h2>{!r.data.by_month.length ? <Empty /> : r.data.by_month.map((m) => <div key={m.month} className="tree-item"><span style={{ flex: 1 }}>{m.month}</span><span>{fmtKwd(m.kwd)} · {m.orders}</span></div>)}</div>
        <div className="card"><h2>آخر الطلبات</h2>{!r.data.recent.length ? <Empty /> : r.data.recent.map((o) => <div key={o.id} className="tree-item"><span style={{ flex: 1 }}>{o.full_name} · {o.package}<div className="faint">{fmtDate(o.created_at)} · {o.provider ?? '—'}</div></span><span>{fmtKwd(o.amount_kwd)} <Status s={o.status} /></span></div>)}</div>
      </div>
      {grant && (
        <Modal title="تسجيل بيع يدوي" onClose={() => setGrant(null)} footer={<><button className="btn sec" onClick={() => setGrant(null)}>إلغاء</button><button className="btn" disabled={!grant.email || !grant.pkg} onClick={async () => {
          const ok = await act(async () => {
            const users = (await q(supabase.rpc('admin_list_users', { p_q: grant.email.trim(), p_filter: 'all', p_limit: 2, p_offset: 0 }))) as { id: string; email: string }[];
            const u = users.find((x) => x.email?.toLowerCase() === grant.email.trim().toLowerCase());
            if (!u) throw new Error('لم يتم العثور على مستخدم بهذا البريد');
            await q(supabase.rpc('admin_grant_package', { p_user: u.id, p_package: grant.pkg, p_ad: grant.ad ? Number(grant.ad) : null, p_amount: grant.amount ? Number(grant.amount) : null, p_note: grant.note || null }));
          }, 'تم تسجيل البيع وتفعيل الباقة');
          if (ok) { setGrant(null); r.reload(); }
        }}>تسجيل وتفعيل</button></>}>
          <div className="row">
            <label className="f">بريد المستخدم<input className="input" dir="ltr" value={grant.email} onChange={(e) => setGrant({ ...grant, email: e.target.value })} /></label>
            <label className="f">الباقة<select className="input" value={grant.pkg} onChange={(e) => setGrant({ ...grant, pkg: e.target.value ? Number(e.target.value) : '' })}><option value="">اختر</option>{(pkgs.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
            <label className="f">رقم الإعلان (للتمييز/التثبيت)<input className="input" value={grant.ad} onChange={(e) => setGrant({ ...grant, ad: e.target.value.replace(/\D/g, '') })} /></label>
            <label className="f">المبلغ المدفوع (د.ك)<input className="input" type="number" step="0.001" value={grant.amount} onChange={(e) => setGrant({ ...grant, amount: e.target.value })} /></label>
          </div>
          <label className="f">ملاحظة / رقم الفاتورة<input className="input" value={grant.note} onChange={(e) => setGrant({ ...grant, note: e.target.value })} /></label>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════ Audit log ════════════════════════════════════
type Log = { id: number; action: string; target_type: string; target_id: string | null; details: Record<string, unknown>; created_at: string; profiles: { full_name: string } | null };
export function Audit() {
  const [page, setPage] = useState(0);
  const list = useLoad(async () => (await q(supabase.from('audit_log').select('*, profiles!audit_log_actor_id_fkey(full_name)').order('created_at', { ascending: false }).range(page * 50, page * 50 + 49))) as unknown as Log[], [page]);
  if (list.loading) return <Loading />;
  if (list.error) return <ErrorBox msg={list.error} retry={list.reload} />;
  return (
    <>
      {!list.data?.length ? <Empty /> : <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>الوقت</th><th>المنفّذ</th><th>العملية</th><th>الهدف</th><th>التفاصيل</th></tr></thead>
        <tbody>{list.data.map((l) => (
          <tr key={l.id}><td className="faint">{fmtDate(l.created_at)}</td><td>{l.profiles?.full_name ?? '—'}</td><td dir="ltr">{l.action}</td><td dir="ltr">{l.target_type}{l.target_id ? ` #${l.target_id}` : ''}</td>
            <td><code dir="ltr" style={{ fontSize: 11, wordBreak: 'break-all' }}>{JSON.stringify(l.details).slice(0, 160)}</code></td></tr>
        ))}</tbody>
      </table></div>}
      <div className="pager"><button className="btn sec sm" disabled={page === 0} onClick={() => setPage(page - 1)}>السابق</button><button className="btn sec sm" disabled={(list.data?.length ?? 0) < 50} onClick={() => setPage(page + 1)}>التالي</button></div>
    </>
  );
}
