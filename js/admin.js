// ماتعطل v5 — لوحة الإدارة. كل صلاحية يتحقق منها الخادم (RLS + دوال admin_*)، والواجهة للعرض فقط.
import { setLang } from './i18n.js?v=502';
import {
  CFG, esc, $, $$, fmtNum, fmtDate, ago, safeImg, initSession, session, rest, rpc, login, logout, myProfile, removeImages,
  icon, CAT_ICONS, toast, sheet, closeSheet, confirmBox, promptBox, busy, localPhone,
} from './core.js?v=502';

setLang('ar');
const GOVS = { capital: 'العاصمة', hawalli: 'حولي', farwaniya: 'الفروانية', jahra: 'الجهراء', ahmadi: 'الأحمدي', mubarak: 'مبارك الكبير' };
const ST = { active: 'نشط', sold: 'مباع', pending: 'مراجعة', hidden: 'مخفي', removed: 'موقوف' };
const REASONS = { spam: 'مزعج', fraud: 'احتيال', prohibited: 'ممنوع', wrong_category: 'قسم خاطئ', duplicate: 'مكرر', sold: 'مباع', offensive: 'مسيء', other: 'أخرى' };
const ROLES = { customer: 'مستخدم', company: 'مستخدم (قديم)', staff: 'مشرف', admin: 'مدير' };
const A = { me: null, isAdmin: false, isOwner: false, cats: [], cat: {}, areas: [], area: {}, tab: 'dash' };
const root = () => $('#adm');
const errMsg = e => { const m = String((e && e.message) || e || ''); if (/forbidden|permission|42501|row-level/i.test(m)) return 'ما عندك صلاحية لهذا الإجراء'; if (/protected|cannot ban yourself|only the owner/i.test(m)) return 'هذا الحساب محمي'; if (/fetch|network/i.test(m)) return 'تعذّر الاتصال'; return 'خطأ: ' + m.slice(0, 120); };
const act = (btn, fn, ok = 'تم') => busy(btn, async () => { try { await fn(); toast(ok, 'ok'); await show(A.tab, true); } catch (e) { toast(errMsg(e), 'err'); } }, '...');
const catName = id => (A.cat[id] && A.cat[id].name_ar) || id;
const areaName = id => (A.area[id] && A.area[id].name_ar) || '';
const stBadge = s => `<span class="st st-${s}">${ST[s] || s}</span>`;
const priceTxt = a => a.price_type === 'free' ? 'مجاناً' : a.price_type === 'ask' || a.price == null ? 'على السوم' : fmtNum(a.price) + ' د.ك';

/* ================= الدخول ================= */
function loginView(msg) {
  root().innerHTML = `<div class="adm-login"><div class="auth-hero"><span class="logo lg">م</span><h2>لوحة إدارة ماتعطل</h2>${msg ? `<p class="note err">${esc(msg)}</p>` : '<p class="muted">للمدراء والمشرفين فقط</p>'}</div>
    <form class="auth" novalidate><label class="lbl">رقم الهاتف</label><div class="phone-inp" dir="ltr"><span>+965</span><input class="inp" name="p" inputmode="tel" autocomplete="username"></div>
    <label class="lbl">كلمة السر</label><input class="inp" name="w" type="password" autocomplete="current-password">
    <button class="btn primary block lg" type="submit">دخول</button>${session() ? '<button type="button" class="link-btn center" data-out>تسجيل الخروج</button>' : ''}</form></div>`;
  const f = $('form', root());
  const o = $('[data-out]', f); if (o) o.onclick = async () => { await logout(); loginView(); };
  f.onsubmit = e => { e.preventDefault(); busy($('[type=submit]', f), async () => { try { const id = f.p.value.includes('@') ? f.p.value : localPhone(f.p.value); if (!id) throw new Error('رقم غير صحيح'); await login(id, f.w.value); await boot(); } catch (err) { toast(/invalid|credentials/i.test(err.message) ? 'بيانات الدخول غير صحيحة' : errMsg(err), 'err'); } }); };
}
async function boot() {
  initSession();
  if (!session()) return loginView();
  try {
    const [isStaff, isAdmin, isOwner, me] = await Promise.all([rpc('is_staff'), rpc('is_admin'), rpc('is_owner'), myProfile()]);
    if (!isStaff) return loginView('هذا الحساب ليس له صلاحية الإدارة.');
    Object.assign(A, { me, isAdmin, isOwner });
    await loadRefs();
  } catch (e) { if (e.status === 401) { await logout(); return loginView(); } return loginView(errMsg(e)); }
  shell();
  show((location.hash.slice(1) || 'dash'));
}
async function loadRefs() {
  const [cats, areas] = await Promise.all([rest('market_categories?select=*&order=sort.asc'), rest('kw_areas?select=*&order=gov.asc,sort.asc')]);
  A.cats = cats || []; A.cat = Object.fromEntries(A.cats.map(c => [c.id, c]));
  A.areas = areas || []; A.area = Object.fromEntries(A.areas.map(a => [a.id, a]));
}
const TABS = [['dash', 'chart', 'الإحصائيات'], ['ads', 'layers', 'الإعلانات'], ['reports', 'flag', 'البلاغات'], ['users', 'users', 'المستخدمون'], ['cats', 'grid', 'الأقسام والخانات'], ['areas', 'pin', 'المناطق'], ['settings', 'settings', 'الإعدادات']];
function shell() {
  root().innerHTML = `<header class="adm-top"><a class="brand" href="./" title="فتح التطبيق"><span class="logo">م</span><span><b>إدارة ماتعطل</b><small>${esc((A.me && (A.me.full_name || A.me.phone)) || '')} · ${A.isOwner ? 'المالك' : A.isAdmin ? 'مدير' : 'مشرف'}</small></span></a>
    <div class="tb-act"><a class="icon-btn light" href="./" title="التطبيق">${icon('home')}</a><button class="icon-btn light" data-logout title="خروج">${icon('logout')}</button></div></header>
    <nav class="adm-tabs hscroll">${TABS.map(([k, ic, n]) => `<a href="#${k}" data-t="${k}">${icon(ic)}<span>${n}</span><b class="tcnt" data-cnt="${k}" hidden></b></a>`).join('')}</nav>
    <main class="adm-main" id="pane"></main>`;
  $('[data-logout]').onclick = async () => { await logout(); loginView(); };
  addEventListener('hashchange', () => show(location.hash.slice(1) || 'dash'));
  badges();
}
async function badges() {
  try {
    const [r, p] = await Promise.all([rest('market_reports?select=id&status=eq.open&limit=99'), rest('market_ads?select=id&status=eq.pending&limit=99')]);
    const set = (k, n) => { const b = $(`[data-cnt="${k}"]`); if (b) { b.hidden = !n; b.textContent = n > 98 ? '99+' : n; } };
    set('reports', (r || []).length); set('ads', (p || []).length);
  } catch (_) { }
}
const PANES = {};
let seq = 0;
async function show(tab, soft) {
  if (!PANES[tab]) tab = 'dash';
  A.tab = tab; const my = ++seq;
  $$('.adm-tabs a').forEach(a => a.classList.toggle('on', a.dataset.t === tab));
  const p = $('#pane'); if (!soft) p.innerHTML = '<div class="adm-loading"><span class="spin"></span></div>';
  try { const out = await PANES[tab](); if (my !== seq) return; p.innerHTML = out.html; out.after && out.after(p); }
  catch (e) { if (my === seq) p.innerHTML = `<div class="empty"><b>تعذّر التحميل</b><p>${esc(errMsg(e))}</p></div>`; }
  if (soft) badges();
}

/* ================= الإحصائيات ================= */
PANES.dash = async () => {
  const s = await rpc('admin_market_stats');
  const k = (n, l, ic, cls = '') => `<div class="kpi ${cls}"><span>${icon(ic)}</span><b>${fmtNum(n)}</b><small>${l}</small></div>`;
  const daily = s.daily || []; const mx = Math.max(1, ...daily.map(d => Math.max(d.ads, d.users)));
  const mv = Math.max(1, ...daily.map(d => d.visits));
  const bc = (s.by_category || []); const mc = Math.max(1, ...bc.map(c => c.n));
  const bg = (s.by_gov || []); const mg = Math.max(1, ...bg.map(c => c.n));
  return {
    html: `<div class="kpis">
      ${k(s.ads_active, 'إعلان نشط', 'layers', 'blue')}${k(s.ads_today, 'إعلانات اليوم', 'plus')}${k(s.ads_7d, 'آخر 7 أيام', 'clock')}${k(s.ads_sold, 'مباع', 'tag')}
      ${k(s.ads_pending, 'قيد المراجعة', 'eye', s.ads_pending ? 'warn' : '')}${k(s.reports_open, 'بلاغ مفتوح', 'flag', s.reports_open ? 'red' : '')}${k(s.ads_removed, 'موقوف/مخفي', 'ban')}${k(s.ads_total, 'إجمالي الإعلانات', 'grid')}
      ${k(s.users, 'مستخدم', 'users', 'blue')}${k(s.users_7d, 'مستخدم جديد (7 أيام)', 'user')}${k(s.users_banned, 'محظور', 'ban')}${k(s.featured_now, 'مميز حالياً', 'star')}
      ${k(s.views, 'مشاهدة', 'eye')}${k(s.calls, 'اتصال', 'phoneCall')}${k(s.wa_taps, 'واتساب', 'wa')}${k(+s.calls + +s.wa_taps, 'إجمالي التواصل', 'chart')}</div>
      <section class="panel"><h3>آخر 14 يوم</h3><div class="legend"><i class="l1"></i>إعلانات <i class="l2"></i>مستخدمون جدد <i class="l3"></i>زيارات</div>
        <div class="bars">${daily.map(d => `<div class="bar" title="${esc(d.day)}: ${d.ads} إعلان، ${d.users} مستخدم، ${d.visits} زيارة، ${d.contacts} تواصل">
          <div class="bstack"><i class="b1" style="height:${(d.ads / mx) * 100}%"></i><i class="b2" style="height:${(d.users / mx) * 100}%"></i><i class="b3" style="height:${(d.visits / mv) * 100}%"></i></div><small>${esc(String(d.day).slice(8, 10))}</small></div>`).join('')}</div></section>
      <div class="grid2"><section class="panel"><h3>الإعلانات النشطة حسب القسم</h3>${bc.map(c => `<div class="hbar"><span>${esc(c.name_ar)}</span><div><i style="width:${(c.n / mc) * 100}%"></i></div><b>${fmtNum(c.n)}</b></div>`).join('')}</section>
      <section class="panel"><h3>حسب المحافظة</h3>${bg.length ? bg.map(c => `<div class="hbar"><span>${esc(GOVS[c.gov] || c.gov)}</span><div><i style="width:${(c.n / mg) * 100}%"></i></div><b>${fmtNum(c.n)}</b></div>`).join('') : '<p class="muted">لا توجد بيانات بعد</p>'}</section></div>`,
  };
};

/* ================= الإعلانات ================= */
const AF = { status: '', cat: '', q: '', user: '', off: 0 };
PANES.ads = async () => {
  const p = ['select=id,title,price,price_type,images,status,category_id,area_id,phone,user_id,reports_count,featured_until,views,removed_reason,created_at', 'order=created_at.desc', 'limit=40', 'offset=' + AF.off];
  if (AF.status) p.push('status=eq.' + AF.status); if (AF.cat) p.push('category_id=eq.' + AF.cat); if (AF.user) p.push('user_id=eq.' + AF.user);
  const q = AF.q.replace(/[,()*\\:"'%]/g, ' ').trim();
  if (q) { if (/^#?\d+$/.test(q)) p.push('or=(id.eq.' + q.replace('#', '') + ',phone.like.*' + q.replace('#', '') + '*)'); else p.push('title=ilike.' + encodeURIComponent('*' + q + '*')); }
  const r = await rest('market_ads?' + p.join('&'), { count: true });
  const rows = r.rows;
  return {
    html: `<div class="toolbar"><input class="inp" data-q placeholder="بحث بالعنوان، رقم الإعلان أو الهاتف" value="${esc(AF.q)}">
      <select class="inp" data-st><option value="">كل الحالات</option>${Object.entries(ST).map(([k, v]) => `<option value="${k}" ${AF.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select class="inp" data-cat><option value="">كل الأقسام</option>${A.cats.map(c => `<option value="${c.id}" ${AF.cat === c.id ? 'selected' : ''}>${esc(c.name_ar)}</option>`).join('')}</select>
      ${AF.user ? `<button class="chip on" data-clruser>مستخدم محدد ✕</button>` : ''}</div>
      <p class="muted">${fmtNum(r.total)} إعلان</p>
      <div class="rows">${rows.length ? rows.map(adRow).join('') : '<div class="empty"><b>لا توجد إعلانات</b></div>'}</div>
      <div class="pager">${AF.off ? '<button class="btn ghost sm" data-prev>السابق</button>' : ''}${r.total > AF.off + 40 ? '<button class="btn ghost sm" data-next>التالي</button>' : ''}</div>`,
    after: el => {
      const reload = () => { AF.off = 0; show('ads'); };
      let tm; $('[data-q]', el).oninput = e => { clearTimeout(tm); tm = setTimeout(() => { AF.q = e.target.value; reload(); }, 450); };
      $('[data-st]', el).onchange = e => { AF.status = e.target.value; reload(); };
      $('[data-cat]', el).onchange = e => { AF.cat = e.target.value; reload(); };
      const cu = $('[data-clruser]', el); if (cu) cu.onclick = () => { AF.user = ''; reload(); };
      const pv = $('[data-prev]', el); if (pv) pv.onclick = () => { AF.off = Math.max(0, AF.off - 40); show('ads'); };
      const nx = $('[data-next]', el); if (nx) nx.onclick = () => { AF.off += 40; show('ads'); };
      bindAdActions(el, rows);
    },
  };
};
function adRow(a) {
  const img = safeImg(a.images && a.images[0]); const feat = a.featured_until && new Date(a.featured_until) > new Date();
  return `<div class="arow"><a class="ath" href="./#/ad/${a.id}" target="_blank" rel="noopener">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : icon('image')}</a>
    <div class="abd"><b>${esc(a.title)}</b><div class="ameta">${stBadge(a.status)}${feat ? '<span class="st st-feat">مميز</span>' : ''}${a.reports_count ? `<span class="st st-removed">${a.reports_count} بلاغ</span>` : ''}<span>#${a.id}</span><span>${esc(catName(a.category_id))}</span><span>${esc(areaName(a.area_id))}</span><span>${esc(priceTxt(a))}</span><span dir="ltr">${esc(a.phone)}</span><span>${esc(ago(a.created_at))}</span><span>${icon('eye')}${fmtNum(a.views)}</span></div>
    ${a.removed_reason ? `<small class="muted">السبب: ${esc(a.removed_reason)}</small>` : ''}</div>
    <div class="aact">${a.status !== 'active' ? `<button class="btn soft xs" data-a="active" data-id="${a.id}">${icon('check')}تفعيل</button>` : ''}
      ${a.status !== 'removed' ? `<button class="btn soft xs danger-t" data-a="removed" data-id="${a.id}">${icon('ban')}إيقاف</button>` : ''}
      <button class="btn ghost xs" data-a="more" data-id="${a.id}">${icon('misc')}</button></div></div>`;
}
function bindAdActions(el, rows) {
  $$('[data-a]', el).forEach(b => b.onclick = async () => {
    const a = rows.find(x => x.id === +b.dataset.id); if (!a) return;
    const k = b.dataset.a;
    if (k === 'active') return act(b, () => rpc('admin_set_ad_status', { p_id: a.id, p_status: 'active' }), 'تم التفعيل');
    if (k === 'removed') { const r = await promptBox('سبب إيقاف الإعلان (يظهر للمعلن)', { placeholder: 'مثال: سلعة ممنوعة' }); if (r == null) return; return act(b, () => rpc('admin_set_ad_status', { p_id: a.id, p_status: 'removed', p_reason: r }), 'تم الإيقاف'); }
    if (k === 'more') adMore(a);
  });
}
function adMore(a) {
  sheet(`<div class="sheet-body"><h3 class="sh-title">#${a.id} · ${esc(a.title)}</h3><div class="menu">
    <a href="./#/ad/${a.id}" target="_blank" rel="noopener">${icon('eye')}<span>عرض الإعلان</span></a>
    ${a.status !== 'hidden' ? `<button data-m="hidden">${icon('eyeOff')}<span>إخفاء مؤقت</span></button>` : ''}
    ${a.status !== 'pending' ? `<button data-m="pending">${icon('clock')}<span>إرجاع للمراجعة</span></button>` : ''}
    <button data-m="user">${icon('user')}<span>كل إعلانات هذا المستخدم</span></button>
    ${A.isAdmin ? `<button data-m="feature">${icon('star')}<span>تمييز الإعلان (إعلان مدفوع)</span><em>${a.featured_until && new Date(a.featured_until) > new Date() ? 'حتى ' + esc(fmtDate(a.featured_until)) : ''}</em></button>` : ''}
    <button data-m="delete" class="danger-t">${icon('trash')}<span>حذف نهائي مع الصور</span></button></div></div>`, {
    onOpen: sh => $$('[data-m]', sh).forEach(b => b.onclick = async () => {
      const m = b.dataset.m;
      if (m === 'user') { closeSheet(true, true); AF.user = a.user_id; AF.off = 0; location.hash = 'ads'; show('ads'); return; }
      if (m === 'hidden' || m === 'pending') { closeSheet(true, true); return act(null, () => rpc('admin_set_ad_status', { p_id: a.id, p_status: m, p_reason: 'admin' })); }
      if (m === 'feature') { const d = await promptBox('عدد أيام التمييز (0 = إلغاء التمييز)', { value: '7' }); if (d == null) return; const n = parseInt(d, 10); if (!(n >= 0 && n <= 365)) return toast('رقم غير صحيح', 'err'); return act(null, () => rpc('admin_feature_ad', { p_id: a.id, p_days: n }), n ? 'تم التمييز' : 'أُلغي التمييز'); }
      if (m === 'delete') { if (!(await confirmBox('حذف الإعلان وصوره نهائياً؟', { ok: 'حذف', danger: true }))) return; return act(null, async () => { const imgs = await rpc('admin_delete_ad', { p_id: a.id }); await removeImages(imgs); }, 'تم الحذف'); }
    }),
  });
}

/* ================= البلاغات ================= */
let RF = 'open';
PANES.reports = async () => {
  const rows = await rest(`market_reports?select=id,ad_id,reason,details,status,created_at,reporter_id,market_ads(id,title,status,images,reports_count,user_id)&order=created_at.desc&limit=100${RF === 'all' ? '' : '&status=eq.' + RF}`) || [];
  return {
    html: `<div class="seg" data-rf>${[['open', 'مفتوحة'], ['resolved', 'تمت معالجتها'], ['dismissed', 'مرفوضة'], ['all', 'الكل']].map(([k, v]) => `<button data-v="${k}" class="${RF === k ? 'on' : ''}">${v}</button>`).join('')}</div>
      <div class="rows">${rows.length ? rows.map(r => { const a = r.market_ads || {}; const img = safeImg(a.images && a.images[0]); return `<div class="arow">
        <a class="ath" href="./#/ad/${r.ad_id}" target="_blank" rel="noopener">${img ? `<img src="${esc(img)}" alt="">` : icon('image')}</a>
        <div class="abd"><b>${esc(a.title || 'إعلان محذوف')}</b><div class="ameta"><span class="st st-removed">${esc(REASONS[r.reason] || r.reason)}</span>${a.status ? stBadge(a.status) : ''}<span>#${r.ad_id}</span><span>${a.reports_count || 0} بلاغ على الإعلان</span><span>${esc(ago(r.created_at))}</span>${r.reporter_id ? '<span>مسجّل</span>' : '<span>زائر</span>'}</div>
        ${r.details ? `<p class="rdet">${esc(r.details)}</p>` : ''}</div>
        <div class="aact">${r.status === 'open' ? `${a.status && a.status !== 'removed' ? `<button class="btn soft xs danger-t" data-r="remove" data-id="${r.id}" data-ad="${r.ad_id}">${icon('ban')}إيقاف الإعلان</button>` : ''}
          <button class="btn soft xs" data-r="dismissed" data-id="${r.id}">${icon('close')}رفض البلاغ</button><button class="btn ghost xs" data-r="resolved" data-id="${r.id}">${icon('check')}تمت</button>` : `<span class="muted">${r.status === 'resolved' ? 'تمت معالجته' : 'مرفوض'}</span>`}</div></div>`; }).join('') : '<div class="empty"><b>لا توجد بلاغات</b></div>'}</div>`,
    after: el => {
      $$('[data-rf] button', el).forEach(b => b.onclick = () => { RF = b.dataset.v; show('reports'); });
      $$('[data-r]', el).forEach(b => b.onclick = async () => {
        if (b.dataset.r === 'remove') { const r = await promptBox('سبب الإيقاف (يظهر للمعلن)', { value: 'مخالف لشروط النشر' }); if (r == null) return; return act(b, () => rpc('admin_set_ad_status', { p_id: +b.dataset.ad, p_status: 'removed', p_reason: r }), 'تم إيقاف الإعلان'); }
        act(b, () => rpc('admin_resolve_report', { p_id: +b.dataset.id, p_status: b.dataset.r }));
      });
    },
  };
};

/* ================= المستخدمون ================= */
const UF = { q: '', filter: 'all', off: 0 };
PANES.users = async () => {
  const rows = await rpc('admin_list_users', { p_q: UF.q || null, p_filter: UF.filter, p_limit: 50, p_offset: UF.off }) || [];
  const total = rows.length ? rows[0].total_count : 0;
  return {
    html: `<div class="toolbar"><input class="inp" data-q placeholder="بحث بالاسم أو رقم الهاتف" value="${esc(UF.q)}">
      <div class="seg" data-uf>${[['all', 'الكل'], ['banned', 'المحظورون'], ['staff', 'الإدارة']].map(([k, v]) => `<button data-v="${k}" class="${UF.filter === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      <p class="muted">${fmtNum(total)} مستخدم</p>
      <div class="rows">${rows.map(u => `<div class="arow urow"><span class="uav${u.is_banned ? ' ban' : ''}">${esc((u.full_name || '#').trim().slice(0, 1))}</span>
        <div class="abd"><b>${esc(u.full_name || 'بدون اسم')}</b><div class="ameta"><span dir="ltr">${esc(u.phone || '—')}</span><span class="st ${u.role === 'admin' || u.role === 'staff' ? 'st-active' : ''}">${ROLES[u.role] || u.role}</span>${u.is_banned ? '<span class="st st-removed">محظور</span>' : ''}<span>${fmtNum(u.ads_active)} نشط / ${fmtNum(u.ads_total)} إعلان</span><span>انضم ${esc(fmtDate(u.created_at))}</span>${u.last_sign_in_at ? `<span>آخر دخول ${esc(ago(u.last_sign_in_at))}</span>` : ''}</div>
        ${u.is_banned && u.banned_reason ? `<small class="muted">سبب الحظر: ${esc(u.banned_reason)}</small>` : ''}</div>
        <div class="aact"><button class="btn ghost xs" data-u="ads" data-id="${u.id}">${icon('layers')}إعلاناته</button>
          ${A.isAdmin && u.id !== session().uid ? (u.is_banned ? `<button class="btn soft xs" data-u="unban" data-id="${u.id}">${icon('check')}فك الحظر</button>` : `<button class="btn soft xs danger-t" data-u="ban" data-id="${u.id}">${icon('ban')}حظر</button>`) : ''}
          ${A.isAdmin && u.id !== session().uid ? `<button class="btn ghost xs" data-u="role" data-id="${u.id}">${icon('shield')}الصلاحية</button>` : ''}</div></div>`).join('') || '<div class="empty"><b>لا يوجد مستخدمون</b></div>'}</div>
      <div class="pager">${UF.off ? '<button class="btn ghost sm" data-prev>السابق</button>' : ''}${total > UF.off + 50 ? '<button class="btn ghost sm" data-next>التالي</button>' : ''}</div>`,
    after: el => {
      let tm; $('[data-q]', el).oninput = e => { clearTimeout(tm); tm = setTimeout(() => { UF.q = e.target.value.trim(); UF.off = 0; show('users'); }, 450); };
      $$('[data-uf] button', el).forEach(b => b.onclick = () => { UF.filter = b.dataset.v; UF.off = 0; show('users'); });
      const pv = $('[data-prev]', el); if (pv) pv.onclick = () => { UF.off = Math.max(0, UF.off - 50); show('users'); };
      const nx = $('[data-next]', el); if (nx) nx.onclick = () => { UF.off += 50; show('users'); };
      $$('[data-u]', el).forEach(b => b.onclick = async () => {
        const u = rows.find(x => x.id === b.dataset.id); const k = b.dataset.u;
        if (k === 'ads') { AF.user = u.id; AF.status = ''; AF.off = 0; location.hash = 'ads'; return; }
        if (k === 'ban') { const r = await promptBox(`حظر ${u.full_name || u.phone}؟ ستتوقف كل إعلاناته ويُسجَّل خروجه.`, { placeholder: 'سبب الحظر', ok: 'حظر' }); if (r == null) return; return act(b, () => rpc('admin_ban_user', { p_user: u.id, p_banned: true, p_reason: r }), 'تم الحظر'); }
        if (k === 'unban') { if (!(await confirmBox('فك الحظر وإعادة إعلاناته؟'))) return; return act(b, () => rpc('admin_ban_user', { p_user: u.id, p_banned: false }), 'تم فك الحظر'); }
        if (k === 'role') roleSheet(u);
      });
    },
  };
};
function roleSheet(u) {
  const opts = A.isOwner ? ['customer', 'staff', 'admin'] : ['customer', 'staff'];
  sheet(`<div class="sheet-body"><h3 class="sh-title">صلاحية ${esc(u.full_name || u.phone)}</h3><div class="radios">${opts.map(r => `<label class="radio"><input type="radio" name="r" value="${r}" ${u.role === r ? 'checked' : ''}><span>${ROLES[r]}${r === 'staff' ? ' — يدير الإعلانات والبلاغات' : r === 'admin' ? ' — صلاحيات كاملة' : ''}</span></label>`).join('')}</div>
    <button class="btn primary block" data-save style="margin-top:14px">حفظ</button></div>`, {
    onOpen: sh => $('[data-save]', sh).onclick = e => { const r = $('input[name=r]:checked', sh); if (!r) return; closeSheet(true, true); act(null, () => rpc('admin_set_role', { p_user: u.id, p_role: r.value })); },
  });
}

/* ================= الأقسام والخانات ================= */
PANES.cats = async () => {
  await loadRefs();
  return {
    html: `<div class="toolbar"><p class="muted" style="flex:1">رتّب الأقسام، فعّلها أو أوقفها، وعدّل الخانات (المواصفات) لكل قسم.</p>${A.isAdmin ? `<button class="btn primary sm" data-new>${icon('plus')}قسم جديد</button>` : ''}</div>
      <div class="rows">${A.cats.map(c => `<div class="arow"><span class="ci sm">${icon(CAT_ICONS.includes(c.icon) ? c.icon : 'box')}</span>
        <div class="abd"><b>${esc(c.name_ar)} <small class="muted">· ${esc(c.name_en)}</small></b><div class="ameta">${c.is_active ? '<span class="st st-active">مفعّل</span>' : '<span class="st">موقوف</span>'}<span>الترتيب ${c.sort}</span><span>${(c.fields || []).length} خانة</span><span>${c.price_label === 'salary' ? 'راتب' : c.price_label === 'rent' ? 'إيجار' : 'سعر'}</span><span dir="ltr">${esc(c.id)}</span></div></div>
        ${A.isAdmin ? `<div class="aact"><button class="btn soft xs" data-edit="${esc(c.id)}">${icon('edit')}تعديل</button></div>` : ''}</div>`).join('')}</div>`,
    after: el => {
      $$('[data-edit]', el).forEach(b => b.onclick = () => catEditor(A.cat[b.dataset.edit]));
      const n = $('[data-new]', el); if (n) n.onclick = () => catEditor(null);
    },
  };
};
const optsToText = o => (o || []).map(x => [x.v, x.ar, x.en].join(' | ')).join('\n');
const textToOpts = s => s.split('\n').map(l => l.split('|').map(x => x.trim())).filter(p => p[0] || p[1]).map(([v, ar, en]) => ({ v: (v || en || ar || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || ('o' + Math.random().toString(36).slice(2, 6)), ar: ar || v, en: en || ar || v }));
function fieldCard(f, i) {
  return `<div class="fcard2" data-fi="${i}"><div class="fc-h"><b>خانة ${i + 1}</b><span><button type="button" class="icon-btn" data-up="${i}" title="أعلى">${icon('arrowUp')}</button><button type="button" class="icon-btn danger-t" data-del="${i}" title="حذف">${icon('trash')}</button></span></div>
    <div class="row3"><input class="inp" data-k="ar" placeholder="الاسم بالعربي" value="${esc(f.ar || '')}"><input class="inp" data-k="en" placeholder="English name" value="${esc(f.en || '')}" dir="ltr"><input class="inp" data-k="k" placeholder="key (english)" value="${esc(f.k || '')}" dir="ltr"></div>
    <div class="row3"><select class="inp" data-k="t">${[['select', 'قائمة اختيارات'], ['text', 'نص'], ['number', 'رقم']].map(([v, n]) => `<option value="${v}" ${f.t === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <label class="check sm"><input type="checkbox" data-k="req" ${f.req ? 'checked' : ''}><span>إلزامية</span></label><label class="check sm"><input type="checkbox" data-k="filter" ${f.filter ? 'checked' : ''}><span>فلتر سريع</span></label></div>
    <textarea class="inp" data-k="o" rows="4" dir="auto" placeholder="الخيارات: سطر لكل خيار بالصيغة: value | عربي | English" ${f.t === 'select' ? '' : 'hidden'}>${esc(optsToText(f.o))}</textarea></div>`;
}
function catEditor(c) {
  const isNew = !c; c = c ? JSON.parse(JSON.stringify(c)) : { id: '', name_ar: '', name_en: '', icon: 'box', sort: (A.cats.length + 1), is_active: true, price_label: 'price', fields: [] };
  const fields = c.fields || [];
  sheet(`<div class="sheet-body catedit"><h3 class="sh-title">${isNew ? 'قسم جديد' : 'تعديل: ' + esc(c.name_ar)}</h3>
    <div class="row2"><div><label class="lbl">الاسم بالعربي</label><input class="inp" name="name_ar" value="${esc(c.name_ar)}"></div><div><label class="lbl">English</label><input class="inp" name="name_en" dir="ltr" value="${esc(c.name_en)}"></div></div>
    <div class="row2"><div><label class="lbl">المعرّف (إنجليزي)</label><input class="inp" name="id" dir="ltr" value="${esc(c.id)}" ${isNew ? '' : 'readonly'} placeholder="cars"></div><div><label class="lbl">الترتيب</label><input class="inp" name="sort" type="number" value="${c.sort}"></div></div>
    <label class="lbl">الأيقونة</label><div class="iconpick">${CAT_ICONS.map(n => `<button type="button" data-ic="${n}" class="${c.icon === n ? 'on' : ''}">${icon(n)}</button>`).join('')}</div>
    <div class="row2"><div><label class="lbl">خانة السعر</label><select class="inp" name="price_label">${[['price', 'السعر'], ['salary', 'الراتب'], ['rent', 'الإيجار']].map(([v, n]) => `<option value="${v}" ${c.price_label === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div><label class="lbl">الحالة</label><label class="check"><input type="checkbox" name="is_active" ${c.is_active ? 'checked' : ''}><span>القسم مفعّل</span></label></div></div>
    <label class="lbl">الخانات (المواصفات)</label><div data-fields></div><button type="button" class="btn ghost sm" data-addf>${icon('plus')}إضافة خانة</button>
    <div class="sticky-act"><button class="btn primary block" data-save>حفظ القسم</button></div></div>`, {
    cls: 'wide',
    onOpen: sh => {
      let ic = c.icon;
      const box = $('[data-fields]', sh);
      const read = () => $$('[data-fi]', box).map(d => {
        const g = k => $(`[data-k="${k}"]`, d);
        const f = { k: g('k').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30), ar: g('ar').value.trim(), en: g('en').value.trim() || g('ar').value.trim(), t: g('t').value };
        if (g('req').checked) f.req = true; if (g('filter').checked) f.filter = true;
        if (f.t === 'select') f.o = textToOpts(g('o').value);
        const old = fields[+d.dataset.fi]; if (old && f.t === 'number') { if (old.min != null) f.min = old.min; if (old.max != null) f.max = old.max; }
        return f;
      });
      const paint = list => {
        fields.splice(0, fields.length, ...list);
        box.innerHTML = fields.map(fieldCard).join('');
        $$('[data-k="t"]', box).forEach(s => s.onchange = () => { s.closest('[data-fi]').querySelector('[data-k="o"]').hidden = s.value !== 'select'; });
        $$('[data-del]', box).forEach(b => b.onclick = () => { const l = read(); l.splice(+b.dataset.del, 1); paint(l); });
        $$('[data-up]', box).forEach(b => b.onclick = () => { const i = +b.dataset.up; if (!i) return; const l = read(); [l[i - 1], l[i]] = [l[i], l[i - 1]]; paint(l); });
      };
      paint(fields.slice());
      $('[data-addf]', sh).onclick = () => paint(read().concat([{ k: '', ar: '', en: '', t: 'select', o: [] }]));
      $$('[data-ic]', sh).forEach(b => b.onclick = () => { ic = b.dataset.ic; $$('[data-ic]', sh).forEach(x => x.classList.toggle('on', x === b)); });
      $('[data-save]', sh).onclick = e => {
        const fl = read();
        const keys = fl.map(f => f.k);
        if (fl.some(f => !f.k || !f.ar)) return toast('كل خانة تحتاج اسم عربي ومفتاح إنجليزي', 'err');
        if (new Set(keys).size !== keys.length) return toast('مفاتيح الخانات لازم تكون مختلفة', 'err');
        if (fl.some(f => f.t === 'select' && !(f.o || []).length)) return toast('خانة القائمة تحتاج خيارات', 'err');
        const body = { name_ar: $('[name=name_ar]', sh).value.trim(), name_en: $('[name=name_en]', sh).value.trim(), icon: ic, sort: +$('[name=sort]', sh).value || 100, is_active: $('[name=is_active]', sh).checked, price_label: $('[name=price_label]', sh).value, fields: fl };
        if (body.name_ar.length < 2 || body.name_en.length < 2) return toast('اكتب اسم القسم بالعربي والإنجليزي', 'err');
        busy(e.currentTarget, async () => {
          try {
            if (isNew) { const id = $('[name=id]', sh).value.trim().toLowerCase(); if (!/^[a-z][a-z0-9_]{1,30}$/.test(id)) return toast('المعرّف: حروف إنجليزية صغيرة وأرقام فقط', 'err'); await rest('market_categories', { method: 'POST', body: Object.assign({ id }, body), prefer: 'return=minimal' }); }
            else { const r = await rest('market_categories?id=eq.' + encodeURIComponent(c.id), { method: 'PATCH', body, prefer: 'return=representation' }); if (!r || !r.length) throw new Error('forbidden'); }
            closeSheet(true, true); toast('تم الحفظ', 'ok'); show('cats', true);
          } catch (err) { toast(errMsg(err), 'err'); }
        });
      };
    },
  });
}

/* ================= المناطق ================= */
PANES.areas = async () => {
  await loadRefs();
  return {
    html: `${A.isAdmin ? `<div class="toolbar"><select class="inp" data-gov>${Object.entries(GOVS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><input class="inp" data-ar placeholder="اسم المنطقة بالعربي"><input class="inp" data-en dir="ltr" placeholder="English name"><button class="btn primary sm" data-add>${icon('plus')}إضافة</button></div>` : ''}
      ${Object.entries(GOVS).map(([g, n]) => `<section class="panel"><h3>${n}</h3><div class="chips">${A.areas.filter(a => a.gov === g).map(a => `<button class="chip${a.is_active ? '' : ' off'}" data-area="${a.id}" title="${a.is_active ? 'اضغط للإيقاف' : 'اضغط للتفعيل'}">${esc(a.name_ar)}${a.is_active ? '' : ' (موقوفة)'}</button>`).join('')}</div></section>`).join('')}`,
    after: el => {
      if (!A.isAdmin) return;
      $$('[data-area]', el).forEach(b => b.onclick = () => { const a = A.area[b.dataset.area]; act(b, async () => { const r = await rest('kw_areas?id=eq.' + a.id, { method: 'PATCH', body: { is_active: !a.is_active }, prefer: 'return=representation' }); if (!r || !r.length) throw new Error('forbidden'); }); });
      $('[data-add]', el).onclick = e => { const ar = $('[data-ar]', el).value.trim(), en = $('[data-en]', el).value.trim(); if (ar.length < 2 || en.length < 2) return toast('اكتب الاسم بالعربي والإنجليزي', 'err'); act(e.currentTarget, () => rest('kw_areas', { method: 'POST', body: { gov: $('[data-gov]', el).value, name_ar: ar, name_en: en, sort: 100 }, prefer: 'return=minimal' }), 'تمت الإضافة'); };
    },
  };
};

/* ================= الإعدادات ================= */
PANES.settings = async () => {
  const rows = await rest('app_settings?select=key,value,is_public&key=in.(market,paid_ads,support_whatsapp)') || [];
  const S = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const m = Object.assign({ require_approval: false, max_ads_per_day: 15, auto_hide_reports: 5, max_images: 10 }, S.market || {});
  const p = Object.assign({ enabled: false, featured_prices: {}, note_ar: '', note_en: '' }, S.paid_ads || {});
  const prices = Object.entries(p.featured_prices || {}).map(([d, v]) => d + '=' + v).join('\n');
  const dis = A.isAdmin ? '' : 'disabled';
  return {
    html: `<form class="settings" novalidate>
      <section class="panel"><h3>${icon('layers')} النشر</h3>
        <label class="check"><input type="checkbox" name="require_approval" ${m.require_approval ? 'checked' : ''} ${dis}><span>مراجعة الإعلانات الجديدة قبل ظهورها</span></label>
        <div class="row3"><div><label class="lbl">حد الإعلانات اليومي لكل مستخدم</label><input class="inp" name="max_ads_per_day" type="number" min="1" max="200" value="${+m.max_ads_per_day}" ${dis}></div>
        <div><label class="lbl">إخفاء تلقائي بعد عدد بلاغات</label><input class="inp" name="auto_hide_reports" type="number" min="0" max="100" value="${+m.auto_hide_reports}" ${dis}><p class="hint">0 = بدون إخفاء تلقائي</p></div>
        <div><label class="lbl">أقصى عدد صور للإعلان</label><input class="inp" name="max_images" type="number" min="1" max="10" value="${+m.max_images}" ${dis}></div></div></section>
      <section class="panel"><h3>${icon('star')} الإعلانات المدفوعة (التمييز)</h3>
        <p class="muted">النشر مجاني دائماً. عند التفعيل يظهر للمعلن خيار «ميّز إعلانك» بالأسعار أدناه ويتواصل معك عبر واتساب، وبعد الدفع تميّز إعلانه من قسم الإعلانات.</p>
        <label class="check"><input type="checkbox" name="paid_enabled" ${p.enabled ? 'checked' : ''} ${dis}><span>تفعيل الإعلانات المميزة المدفوعة</span></label>
        <label class="lbl">الأسعار (سطر لكل باقة: الأيام=السعر بالدينار)</label><textarea class="inp" name="prices" rows="4" dir="ltr" ${dis}>${esc(prices)}</textarea></section>
      <section class="panel"><h3>${icon('wa')} الدعم</h3><label class="lbl">رقم واتساب الدعم (مع 965)</label><input class="inp" name="support" dir="ltr" value="${esc(S.support_whatsapp || CFG.supportWa)}" ${dis}></section>
      ${A.isAdmin ? '<button class="btn primary lg" type="submit">حفظ الإعدادات</button>' : '<p class="note">التعديل متاح للمدير فقط.</p>'}</form>`,
    after: el => {
      const f = $('form', el);
      f.onsubmit = e => {
        e.preventDefault();
        const fp = {};
        for (const line of f.prices.value.split('\n')) { const [d, v] = line.split('=').map(x => x && x.trim()); if (!d) continue; if (!(+d > 0 && +v >= 0)) return toast('صيغة الأسعار: 7=4', 'err'); fp[String(+d)] = +v; }
        const sup = f.support.value.replace(/\D/g, ''); if (!/^965[569]\d{7}$/.test(sup)) return toast('رقم الدعم: 965 ثم 8 أرقام', 'err');
        const market = Object.assign({}, m, { require_approval: f.require_approval.checked, max_ads_per_day: Math.max(1, +f.max_ads_per_day.value || 15), auto_hide_reports: Math.max(0, +f.auto_hide_reports.value || 0), max_images: Math.min(10, Math.max(1, +f.max_images.value || 10)) });
        const paid = Object.assign({}, p, { enabled: f.paid_enabled.checked, featured_prices: fp });
        act($('[type=submit]', f), async () => {
          await rest('app_settings?on_conflict=key', { method: 'POST', body: [{ key: 'market', value: market, is_public: true }, { key: 'paid_ads', value: paid, is_public: true }, { key: 'support_whatsapp', value: sup, is_public: true }], prefer: 'resolution=merge-duplicates,return=minimal' });
        }, 'تم حفظ الإعدادات');
      };
    },
  };
};

boot();
