import { useState } from 'react';
import {
  ALL_PERMS, Bars, Empty, ErrorBox, HBars, Loading, Modal, PERM_LABEL, Pager, Status, can, fmtDate, fmtKwd, publicUrl, q, supabase,
  useAction, useLoad, useMe, type Perm, type Role,
} from '../lib';

// ══════════════════════════ Dashboard ════════════════════════════════════
type Stats = {
  users_total: number; users_new_7d: number; users_new_today: number; users_banned: number; ads_total: number;
  ads_by_status: Record<string, number>; ads_new_today: number; ads_featured: number; reports_open: number; tickets_open: number;
  messages_today: number; revenue_kwd_30d: number;
  by_category: { id: number; name_ar: string; n: number }[]; by_governorate: { id: number; name_ar: string; n: number }[];
  daily: { day: string; users: number; ads: number; opens: number; views: number }[];
};

export function Dashboard() {
  const s = useLoad(async () => (await q(supabase.rpc('admin_stats'))) as Stats, []);
  if (s.loading) return <Loading />;
  if (s.error || !s.data) return <ErrorBox msg={s.error ?? ''} retry={s.reload} />;
  const d = s.data;
  const st = d.ads_by_status ?? {};
  const kpis: [string, number | string][] = [
    ['إجمالي المستخدمين', d.users_total], ['مستخدمون جدد (7 أيام)', d.users_new_7d], ['مستخدمون جدد اليوم', d.users_new_today],
    ['إجمالي الإعلانات', d.ads_total], ['الإعلانات النشطة', st.active ?? 0], ['قيد المراجعة', st.pending ?? 0],
    ['المنتهية', st.expired ?? 0], ['المباعة', st.sold ?? 0], ['إعلانات اليوم', d.ads_new_today], ['المميزة الآن', d.ads_featured],
    ['بلاغات مفتوحة', d.reports_open], ['طلبات دعم مفتوحة', d.tickets_open], ['رسائل اليوم', d.messages_today],
    ['حسابات محظورة', d.users_banned], ['إيرادات 30 يوماً', fmtKwd(d.revenue_kwd_30d)],
  ];
  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="grid kpis">{kpis.map(([l, v]) => <div key={l} className="card kpi"><div className="bar" /><div className="v">{v}</div><div className="l">{l}</div></div>)}</div>
      <div className="grid two">
        <div className="card"><h2>زيارات التطبيق (14 يوماً)</h2><Bars label="زيارات التطبيق" data={d.daily.map((x) => ({ x: x.day, y: x.opens }))} /></div>
        <div className="card"><h2>مشاهدات الإعلانات</h2><Bars label="مشاهدات الإعلانات" data={d.daily.map((x) => ({ x: x.day, y: x.views }))} /></div>
        <div className="card"><h2>الإعلانات الجديدة</h2><Bars label="الإعلانات الجديدة" data={d.daily.map((x) => ({ x: x.day, y: x.ads }))} /></div>
        <div className="card"><h2>المستخدمون الجدد</h2><Bars label="المستخدمون الجدد" data={d.daily.map((x) => ({ x: x.day, y: x.users }))} /></div>
        <div className="card"><h2>الإعلانات النشطة حسب القسم</h2><HBars rows={d.by_category.map((x) => ({ label: x.name_ar, n: x.n }))} /></div>
        <div className="card"><h2>الإعلانات النشطة حسب المحافظة</h2><HBars rows={d.by_governorate.map((x) => ({ label: x.name_ar, n: x.n }))} /></div>
      </div>
    </div>
  );
}

// ══════════════════════════ Ads ══════════════════════════════════════════
type AdRow = {
  id: number; title: string; status: string; price: number | null; price_type: string; cover_path: string | null; created_at: string;
  user_id: string; reject_reason: string | null; featured_until: string | null; pinned_until: string | null; views_count: number;
  description: string; profiles: { full_name: string } | null; categories: { name_ar: string } | null;
};
const PAGE = 25;

export function Ads() {
  const me = useMe();
  const act = useAction();
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [reject, setReject] = useState<AdRow | null>(null);
  const [view, setView] = useState<AdRow | null>(null);
  const [promote, setPromote] = useState<AdRow | null>(null);
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(7);
  const list = useLoad(async () => {
    let x = supabase.from('ads').select('id,title,status,price,price_type,cover_path,created_at,user_id,reject_reason,featured_until,pinned_until,views_count,description,profiles(full_name),categories!ads_category_id_fkey(name_ar)')
      .order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE);
    if (status === 'featured') x = x.gt('featured_until', new Date().toISOString());
    else if (status !== 'all') x = x.eq('status', status);
    const s = search.trim();
    if (s) x = /^\d+$/.test(s) ? x.eq('id', Number(s)) : x.ilike('title', `%${s}%`);
    return (await q(x)) as unknown as AdRow[];
  }, [status, search, page]);

  const setAd = (id: number, st: string, r?: string) => act(() => q(supabase.rpc('admin_set_ad_status', { p_ad: id, p_status: st, p_reason: r ?? null })), 'تم تحديث الإعلان').then((ok) => ok && list.reload());
  const del = async (a: AdRow) => {
    if (!confirm(`حذف الإعلان #${a.id} نهائياً مع صوره؟`)) return;
    await act(async () => {
      const imgs = (await q(supabase.from('ad_images').select('path').eq('ad_id', a.id))) as { path: string }[];
      if (imgs.length) await supabase.storage.from('ad-images').remove(imgs.map((i) => i.path));
      await q(supabase.from('ads').delete().eq('id', a.id).select('id'));
    }, 'تم الحذف');
    list.reload();
  };
  const rows = (list.data ?? []).slice(0, PAGE);

  return (
    <>
      <div className="toolbar">
        <div className="chips">
          {[['pending', 'قيد المراجعة'], ['active', 'نشطة'], ['rejected', 'مرفوضة'], ['expired', 'منتهية'], ['sold', 'مباعة'], ['hidden', 'مخفية'], ['featured', 'مميزة'], ['all', 'الكل']].map(([v, l]) => (
            <button key={v} className={`chip ${status === v ? 'on' : ''}`} onClick={() => { setStatus(v); setPage(0); }}>{l}</button>
          ))}
        </div>
        <input className="input" placeholder="بحث بالعنوان أو رقم الإعلان" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} style={{ flex: 1, minWidth: 200 }} />
      </div>
      {list.loading ? <Loading /> : list.error ? <ErrorBox msg={list.error} retry={list.reload} /> : !rows.length ? <Empty /> : (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th></th><th>الإعلان</th><th>القسم</th><th>المعلن</th><th>السعر</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th></tr></thead>
          <tbody>{rows.map((a) => (
            <tr key={a.id}>
              <td>{a.cover_path ? <img className="thumb" src={publicUrl('ad-images', a.cover_path)} alt="" loading="lazy" /> : <div className="thumb" />}</td>
              <td><a href="#" onClick={(e) => { e.preventDefault(); setView(a); }}>#{a.id} · {a.title}</a>{a.reject_reason && a.reject_reason !== '__banned__' && <div className="faint">{a.reject_reason}</div>}</td>
              <td>{a.categories?.name_ar}</td>
              <td>{a.profiles?.full_name}</td>
              <td>{a.price_type === 'contact' ? 'تواصل' : a.price_type === 'free' ? 'مجاناً' : fmtKwd(a.price)}</td>
              <td><Status s={a.status} />{a.featured_until && new Date(a.featured_until) > new Date() && <span className="badge primary" style={{ marginInlineStart: 4 }}>مميز</span>}</td>
              <td className="faint">{fmtDate(a.created_at)}</td>
              <td><div className="actions">
                {a.status !== 'active' && a.status !== 'sold' && <button className="btn ok sm" onClick={() => setAd(a.id, 'active')}>قبول</button>}
                {a.status !== 'rejected' && <button className="btn danger sm" onClick={() => { setReject(a); setReason(''); }}>رفض</button>}
                {a.status === 'active' && <button className="btn sec sm" onClick={() => setAd(a.id, 'hidden')}>إخفاء</button>}
                {can(me, 'commerce') && a.status === 'active' && <button className="btn sec sm" onClick={() => setPromote(a)}>تمييز</button>}
                <button className="btn danger sm" onClick={() => del(a)}>حذف</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Pager page={page} setPage={setPage} hasMore={(list.data?.length ?? 0) > PAGE} />

      {reject && (
        <Modal title={`رفض الإعلان #${reject.id}`} onClose={() => setReject(null)}
          footer={<><button className="btn sec" onClick={() => setReject(null)}>إلغاء</button><button className="btn danger" disabled={!reason.trim()} onClick={() => { setAd(reject.id, 'rejected', reason.trim()); setReject(null); }}>رفض وإبلاغ المعلن</button></>}>
          <div className="chips" style={{ marginBottom: 10 }}>
            {['صور غير واضحة أو غير حقيقية', 'منتج ممنوع', 'القسم غير صحيح', 'إعلان مكرر', 'معلومات مضللة'].map((r) => <button key={r} className="chip" onClick={() => setReason(r)}>{r}</button>)}
          </div>
          <textarea className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الرفض (يظهر للمعلن)" />
        </Modal>
      )}
      {promote && (
        <Modal title={`تمييز الإعلان #${promote.id}`} onClose={() => setPromote(null)}
          footer={<>
            <button className="btn sec" onClick={() => setPromote(null)}>إغلاق</button>
            <button className="btn sec" onClick={() => act(() => q(supabase.rpc('admin_promote_ad', { p_ad: promote.id, p_kind: 'unfeature', p_days: 0 }))).then(() => { setPromote(null); list.reload(); })}>إلغاء التمييز</button>
            <button className="btn sec" onClick={() => act(() => q(supabase.rpc('admin_promote_ad', { p_ad: promote.id, p_kind: 'bump', p_days: 0 })), 'تم الرفع').then(() => { setPromote(null); list.reload(); })}>رفع للأعلى</button>
            <button className="btn sec" onClick={() => act(() => q(supabase.rpc('admin_promote_ad', { p_ad: promote.id, p_kind: 'pin', p_days: days })), 'تم التثبيت').then(() => { setPromote(null); list.reload(); })}>تثبيت</button>
            <button className="btn" onClick={() => act(() => q(supabase.rpc('admin_promote_ad', { p_ad: promote.id, p_kind: 'feature', p_days: days })), 'تم التمييز').then(() => { setPromote(null); list.reload(); })}>تمييز</button>
          </>}>
          <label className="f">المدة بالأيام<input className="input" type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} /></label>
          <p className="faint">مميز حتى: {fmtDate(promote.featured_until)} · مثبّت حتى: {fmtDate(promote.pinned_until)}</p>
        </Modal>
      )}
      {view && (
        <Modal title={`#${view.id} · ${view.title}`} onClose={() => setView(null)} footer={<button className="btn sec" onClick={() => setView(null)}>إغلاق</button>}>
          {view.cover_path && <img src={publicUrl('ad-images', view.cover_path)} alt="" style={{ width: '100%', borderRadius: 16, marginBottom: 12 }} />}
          <p style={{ whiteSpace: 'pre-wrap' }}>{view.description || '—'}</p>
          <p className="faint">المشاهدات: {view.views_count} · المعلن: {view.profiles?.full_name} · {view.user_id}</p>
        </Modal>
      )}
    </>
  );
}

// ══════════════════════════ Reports ══════════════════════════════════════
type Report = { id: number; target_type: string; target_id: string; target_user_id: string | null; reason: string; details: string | null; status: string; created_at: string; resolution_note: string | null; reporter: { full_name: string } | null; target: { full_name: string } | null };
const REASONS: Record<string, string> = { scam: 'احتيال', prohibited: 'منتج ممنوع', offensive: 'محتوى مسيء', spam: 'إزعاج', wrong_category: 'قسم خاطئ', duplicate: 'مكرر', sold: 'مباع', other: 'أخرى' };
const TARGETS: Record<string, string> = { ad: 'إعلان', user: 'مستخدم', conversation: 'محادثة', message: 'رسالة' };

export function Reports() {
  const act = useAction();
  const [status, setStatus] = useState('open');
  const [open, setOpen] = useState<Report | null>(null);
  const [note, setNote] = useState('');
  const list = useLoad(async () => (await q(supabase.from('reports')
    .select('*, reporter:profiles!reports_reporter_id_fkey(full_name), target:profiles!reports_target_user_id_fkey(full_name)')
    .eq('status', status).order('created_at', { ascending: false }).limit(100))) as unknown as Report[], [status]);
  const msgs = useLoad(async () => (open && (open.target_type === 'conversation' || open.target_type === 'message')
    ? ((await q(supabase.rpc('admin_report_messages', { p_report: open.id }))) as { id: number; sender_name: string; body: string | null; image_path: string | null; created_at: string }[]) : []), [open?.id]);

  const resolve = (st: 'resolved' | 'dismissed', action: string) =>
    act(() => q(supabase.rpc('admin_resolve_report', { p_report: open!.id, p_status: st, p_note: note || null, p_action: action })), 'تمت معالجة البلاغ').then((ok) => { if (ok) { setOpen(null); list.reload(); } });

  return (
    <>
      <div className="toolbar chips">
        {[['open', 'مفتوحة'], ['resolved', 'تمت معالجتها'], ['dismissed', 'مرفوضة']].map(([v, l]) => <button key={v} className={`chip ${status === v ? 'on' : ''}`} onClick={() => setStatus(v)}>{l}</button>)}
      </div>
      {list.loading ? <Loading /> : list.error ? <ErrorBox msg={list.error} retry={list.reload} /> : !list.data?.length ? <Empty text="لا توجد بلاغات" /> : (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>#</th><th>النوع</th><th>السبب</th><th>المُبلِّغ</th><th>المُبلَّغ عنه</th><th>التاريخ</th><th></th></tr></thead>
          <tbody>{list.data.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td><td>{TARGETS[r.target_type]} {r.target_type === 'ad' && <span className="faint">#{r.target_id}</span>}</td>
              <td>{REASONS[r.reason]}{r.details && <div className="faint">{r.details}</div>}</td>
              <td>{r.reporter?.full_name ?? '—'}</td><td>{r.target?.full_name ?? '—'}</td><td className="faint">{fmtDate(r.created_at)}</td>
              <td><button className="btn sec sm" onClick={() => { setOpen(r); setNote(''); }}>مراجعة</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {open && (
        <Modal title={`بلاغ #${open.id} · ${TARGETS[open.target_type]}`} onClose={() => setOpen(null)}
          footer={open.status === 'open' ? <>
            <button className="btn sec" onClick={() => resolve('dismissed', 'none')}>رفض البلاغ</button>
            <button className="btn ok" onClick={() => resolve('resolved', 'none')}>تمت المعالجة</button>
            {open.target_type === 'ad' && <button className="btn danger" onClick={() => resolve('resolved', 'hide_ad')}>إزالة الإعلان</button>}
            {open.target_user_id && <button className="btn danger" onClick={() => resolve('resolved', 'ban_user')}>حظر المستخدم</button>}
          </> : <button className="btn sec" onClick={() => setOpen(null)}>إغلاق</button>}>
          <p><b>{REASONS[open.reason]}</b> — {open.details || 'بدون تفاصيل'}</p>
          {open.target_type === 'ad' && <p><a href={`#/ads`} onClick={() => setOpen(null)}>فتح قائمة الإعلانات</a> · رقم الإعلان {open.target_id}</p>}
          {(open.target_type === 'conversation' || open.target_type === 'message') && (
            <div className="card" style={{ maxHeight: 260, overflow: 'auto', marginBottom: 12 }}>
              <div className="faint" style={{ marginBottom: 6 }}>يمكن الاطلاع على المحادثة فقط لأنها موضوع بلاغ. هذا الاطلاع مسجّل.</div>
              {msgs.loading ? <Loading /> : (msgs.data ?? []).slice().reverse().map((m) => <div key={m.id} style={{ marginBottom: 6 }}><b>{m.sender_name}:</b> {m.body ?? '[صورة]'} <span className="faint">{fmtDate(m.created_at)}</span></div>)}
            </div>
          )}
          {open.status === 'open' && <textarea className="input" placeholder="ملاحظة المعالجة (اختياري)" value={note} onChange={(e) => setNote(e.target.value)} />}
          {open.resolution_note && <p className="faint">{open.resolution_note}</p>}
        </Modal>
      )}
    </>
  );
}

// ══════════════════════════ Users ════════════════════════════════════════
type UserRow = { id: string; full_name: string; email: string; phone: string | null; role: Role; is_banned: boolean; is_merchant: boolean; active_ads_count: number; created_at: string; last_seen_at: string | null; permissions: Perm[]; total: number };

export function Users() {
  const me = useMe();
  const act = useAction();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [ban, setBan] = useState<UserRow | null>(null);
  const [roleFor, setRoleFor] = useState<UserRow | null>(null);
  const [reason, setReason] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [perms, setPerms] = useState<Set<Perm>>(new Set());
  const list = useLoad(async () => (await q(supabase.rpc('admin_list_users', { p_q: search.trim(), p_filter: filter, p_limit: PAGE, p_offset: page * PAGE }))) as UserRow[], [search, filter, page]);
  const canRoles = me.role === 'owner' || me.role === 'admin';

  return (
    <>
      <div className="toolbar">
        <div className="chips">{[['all', 'الكل'], ['new', 'الجدد'], ['merchants', 'التجار'], ['staff', 'فريق الإدارة'], ['banned', 'المحظورون']].map(([v, l]) =>
          <button key={v} className={`chip ${filter === v ? 'on' : ''}`} onClick={() => { setFilter(v); setPage(0); }}>{l}</button>)}</div>
        <input className="input" placeholder="بحث بالاسم أو البريد أو الهاتف" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} style={{ flex: 1, minWidth: 200 }} />
      </div>
      {list.loading ? <Loading /> : list.error ? <ErrorBox msg={list.error} retry={list.reload} /> : !list.data?.length ? <Empty /> : (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>الاسم</th><th>البريد (غير موثّق)</th><th>الهاتف</th><th>الصلاحية</th><th>إعلانات نشطة</th><th>التسجيل</th><th>آخر ظهور</th><th></th></tr></thead>
          <tbody>{list.data.map((u) => (
            <tr key={u.id}>
              <td>{u.full_name} {u.is_banned && <span className="badge banned">محظور</span>} {u.is_merchant && <span className="badge primary">تاجر</span>}</td>
              <td className="faint">{u.email}</td><td>{u.phone ?? '—'}</td>
              <td>{{ owner: 'المالك', admin: 'مدير', moderator: 'مشرف', user: 'مستخدم' }[u.role]}{u.role === 'moderator' && <div className="faint">{u.permissions.map((p) => PERM_LABEL[p]).join('، ')}</div>}</td>
              <td>{u.active_ads_count}</td><td className="faint">{fmtDate(u.created_at)}</td><td className="faint">{fmtDate(u.last_seen_at)}</td>
              <td><div className="actions">
                {u.role !== 'owner' && u.id !== me.id && (u.is_banned
                  ? <button className="btn ok sm" onClick={() => act(() => q(supabase.rpc('admin_set_ban', { p_user: u.id, p_banned: false, p_reason: null })), 'تم فك الحظر').then(list.reload)}>فك الحظر</button>
                  : <button className="btn danger sm" onClick={() => { setBan(u); setReason(''); }}>حظر</button>)}
                {canRoles && u.role !== 'owner' && u.id !== me.id && <button className="btn sec sm" onClick={() => { setRoleFor(u); setRole(u.role); setPerms(new Set(u.permissions)); }}>الصلاحيات</button>}
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Pager page={page} setPage={setPage} hasMore={(list.data?.[0]?.total ?? 0) > (page + 1) * PAGE} />
      {ban && (
        <Modal title={`حظر ${ban.full_name}`} onClose={() => setBan(null)}
          footer={<><button className="btn sec" onClick={() => setBan(null)}>إلغاء</button>
            <button className="btn danger" disabled={!reason.trim()} onClick={() => act(() => q(supabase.rpc('admin_set_ban', { p_user: ban.id, p_banned: true, p_reason: reason.trim() })), 'تم الحظر').then(() => { setBan(null); list.reload(); })}>حظر الحساب</button></>}>
          <p className="muted">سيتم إخفاء جميع إعلاناته وإنهاء جلساته فوراً، ويمكن التراجع لاحقاً.</p>
          <textarea className="input" placeholder="سبب الحظر" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Modal>
      )}
      {roleFor && (
        <Modal title={`صلاحيات ${roleFor.full_name}`} onClose={() => setRoleFor(null)}
          footer={<><button className="btn sec" onClick={() => setRoleFor(null)}>إلغاء</button>
            <button className="btn" onClick={() => act(() => q(supabase.rpc('admin_set_role', { p_user: roleFor.id, p_role: role, p_permissions: [...perms] })), 'تم تحديث الصلاحيات').then(() => { setRoleFor(null); list.reload(); })}>حفظ</button></>}>
          <div className="chips" style={{ marginBottom: 12 }}>
            {(['user', 'moderator', ...(me.role === 'owner' ? ['admin'] : [])] as Role[]).map((r) => <button key={r} className={`chip ${role === r ? 'on' : ''}`} onClick={() => setRole(r)}>{{ user: 'مستخدم', moderator: 'مشرف', admin: 'مدير', owner: '' }[r]}</button>)}
          </div>
          {role === 'moderator' && <div className="row">{ALL_PERMS.map((p) => (
            <label key={p} className="check"><input type="checkbox" checked={perms.has(p)} onChange={(e) => { const n = new Set(perms); if (e.target.checked) n.add(p); else n.delete(p); setPerms(n); }} />{PERM_LABEL[p]}</label>
          ))}</div>}
          {role === 'admin' && <p className="muted">المدير يملك جميع الصلاحيات ما عدا إدارة المالك.</p>}
        </Modal>
      )}
    </>
  );
}
