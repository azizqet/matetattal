// ماتعطل — لوحة الإدارة. كل صلاحية هنا محمية في الخادم (RLS + is_admin)، والواجهة مجرد عرض.
import {
  esc, $, $$, todayISO, addDays, digits, localPhone, intlPhone, rnd, safeImg, fmtDate, fmtNum, norm, errText,
  initSession, session, login, logout, myProfile, rpc, rest, shrinkImage, upload, icon, svcIcon, toast, sheet, closeSheet, confirmBox, busy,
} from './core.js';

initSession('session'); // جلسة الإدارة تنتهي بإغلاق المتصفح
const A = { me: null, tab: 'overview', services: [], areas: [], cache: {} };
const TABS = [
  ['overview', 'نظرة عامة', 'chart'], ['companies', 'مقدمو الخدمات', 'store'], ['join', 'طلبات الانضمام', 'users'],
  ['ads', 'الإعلانات', 'megaphone'], ['subs', 'الاشتراكات والمدفوعات', 'card'], ['catalog', 'الأقسام والمناطق', 'grid'],
  ['content', 'البنرات والمحتوى', 'layers'], ['users', 'المستخدمون', 'user'],
];
const svcName = id => (A.services.find(s => s.id === id) || {}).name_ar || id || '—';
const root = () => $('#adm');
const tgStatus = c => {
  if (c.status === 'pending') return '<span class="tg warn">بانتظار الموافقة</span>';
  if (c.status === 'rejected') return '<span class="tg bad">مرفوض</span>';
  if (c.status === 'suspended' || !c.is_active) return '<span class="tg bad">موقوف</span>';
  if (c.sub_end < todayISO()) return '<span class="tg warn">اشتراك منتهي</span>';
  return '<span class="tg ok">ظاهر</span>';
};
const visible = c => c.status === 'approved' && c.is_active && c.sub_end >= todayISO();

/* ---------------- الدخول ---------------- */
function loginView(msg) {
  root().innerHTML = `<div class="login-wrap"><form class="login-card" id="lf" novalidate>
    <div class="logo"><span class="mark">م</span>ماتعطل</div>
    <div><h2 style="margin:0 0 4px">لوحة الإدارة</h2><p style="margin:0;color:var(--mut);font-size:14px">للمالك والمشرفين فقط. الصلاحية يتحقق منها الخادم.</p></div>
    ${msg ? `<div class="note bad">${icon('lock')}<div>${esc(msg)}</div></div>` : ''}
    <div class="field"><label for="lid">رقم الهاتف أو البريد</label><input class="inp ltr" id="lid" autocomplete="username" placeholder="XXXXXXXX"></div>
    <div class="field"><label for="lpw">كلمة السر</label><input class="inp" id="lpw" type="password" autocomplete="current-password"></div>
    <button class="btn primary block" type="submit">دخول</button>
    <a class="btn ghost block" href="./">العودة للتطبيق</a></form></div>`;
  $('#lf').onsubmit = e => { e.preventDefault(); busy($('#lf button[type=submit]'), async () => {
    try { await login($('#lid').value, $('#lpw').value); await boot(); } catch (err) { toast(errText(err), 'err'); }
  }, 'جاري الدخول...'); };
}
async function boot() {
  if (!session()) return loginView();
  try {
    const [isAdmin, me] = await Promise.all([rpc('is_admin'), myProfile()]);
    if (!isAdmin) { await logout(); return loginView('هذا الحساب ليس لديه صلاحية إدارة.'); }
    A.me = me;
    const [sv, ar] = await Promise.all([rest('services?select=*&order=sort.asc'), rest('areas?select=*&order=id.asc')]);
    A.services = sv || []; A.areas = ar || [];
    A.tab = (location.hash.replace('#', '') || 'overview'); if (!TABS.some(t => t[0] === A.tab)) A.tab = 'overview';
    shell(); show();
  } catch (e) { if (e.status === 401) { await logout(); return loginView('انتهت الجلسة. سجّل الدخول من جديد.'); } loginView(errText(e)); }
}
function shell() {
  const nav = TABS.map(([id, t, ic]) => `<a href="#${id}" data-tab="${id}">${icon(ic)}${t}<span class="cnt" data-cnt="${id}" hidden></span></a>`).join('');
  root().innerHTML = `<div class="adm"><aside class="adm-side"><div class="logo"><span class="mark">م</span>ماتعطل</div>${nav}
    <a href="./" style="margin-top:12px">${icon('home')}فتح التطبيق</a><a href="#" data-act="logout">${icon('logout')}خروج</a>
    <div class="foot">${esc((A.me && A.me.full_name) || '')}<br>${esc((A.me && A.me.phone) ? '+965 ' + A.me.phone : session().email)}</div></aside>
    <div><div class="adm-tabs">${nav}<a href="#" data-act="logout">${icon('logout')}خروج</a></div><main class="adm-main" id="main"></main></div></div>`;
  refreshCounts();
}
async function refreshCounts() {
  try {
    const [pc, jr, ad] = await Promise.all([
      rest('companies?select=id&status=eq.pending'), rest('join_requests?select=id&status=eq.new'), rest('ad_campaigns?select=id&status=eq.pending')]);
    const set = (k, n) => $$(`[data-cnt="${k}"]`).forEach(x => { x.hidden = !n; x.textContent = n; });
    set('join', (pc || []).length + (jr || []).length); set('ads', (ad || []).length);
  } catch (_) { }
}
addEventListener('hashchange', () => { const t = location.hash.replace('#', ''); if (TABS.some(x => x[0] === t)) { A.tab = t; show(); } });
async function show() {
  $$('[data-tab]').forEach(a => a.classList.toggle('on', a.dataset.tab === A.tab));
  const m = $('#main'); m.innerHTML = '<div class="sk" style="height:200px"></div>';
  try { await VIEWS[A.tab](m); } catch (e) { m.innerHTML = `<div class="note bad">${icon('info')}<div>${esc(errText(e))}</div></div><button class="btn primary" style="margin-top:10px" data-act="reload">إعادة المحاولة</button>`; }
}
const head = (t, right = '') => `<div class="adm-h"><h1>${esc(t)}</h1><div style="display:flex;gap:8px">${right}<button class="btn sm ghost" data-act="reload">${icon('refresh')}تحديث</button></div></div>`;
async function act(btn, fn, ok) { return busy(btn, async () => { try { await fn(); if (ok) toast(ok, 'ok'); closeSheet(); await show(); refreshCounts(); } catch (e) { toast(errText(e), 'err'); } }); }
const patch = (table, id, body) => rest(`${table}?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body, prefer: 'return=representation' }).then(r => { if (!r || !r.length) throw new Error('forbidden'); return r[0]; });

/* ---------------- نظرة عامة ---------------- */
async function vOverview(m) {
  const since = addDays(todayISO(), -29);
  const [st, daily, ads, top] = await Promise.all([
    rpc('admin_stats'), rest(`site_stats_daily?select=day,metric,count&day=gte.${since}&order=day.asc`),
    rest('ad_campaigns?select=id,status,payment_status,starts_at,ends_at,views,clicks,amount_kwd'),
    rest('companies?select=id,name,service_id,visits,calls,wa_taps&order=visits.desc&limit=10'),
  ]);
  const days = []; for (let i = 29; i >= 0; i--) days.push(addDays(todayISO(), -i));
  const by = (metric) => days.map(d => ((daily || []).find(x => x.day === d && x.metric === metric) || {}).count || 0);
  const visits = by('visit'), contacts = days.map((_, i) => by('call')[i] + by('whatsapp')[i]);
  const sum = a => a.reduce((x, y) => x + y, 0), max = Math.max(1, ...visits, ...contacts);
  const now = Date.now(), live = (ads || []).filter(a => a.status === 'approved' && a.payment_status === 'paid' && Date.parse(a.starts_at) <= now && Date.parse(a.ends_at) > now);
  const adRev = (ads || []).filter(a => a.payment_status === 'paid').reduce((s, a) => s + Number(a.amount_kwd || 0), 0);
  const k = (t, v, hl) => `<div class="kpi ${hl ? 'hl' : ''}"><small>${t}</small><b>${v}</b></div>`;
  m.innerHTML = head('نظرة عامة') + `
    <div class="kpis">${k('مقدمو خدمة ظاهرون', fmtNum(st.companies_visible), 1)}${k('بانتظار الموافقة', fmtNum(st.companies_pending + st.join_requests_new))}${k('تنتهي خلال 7 أيام', fmtNum(st.expiring_7d))}${k('إجمالي مقدمي الخدمة', fmtNum(st.companies_total))}
    ${k('زيارات (30 يوم)', fmtNum(sum(visits)))}${k('اتصال + واتساب (30 يوم)', fmtNum(sum(contacts)))}${k('مشاهدات مقدمي الخدمة', fmtNum(st.visits))}${k('نقرات اتصال/واتساب (الإجمالي)', fmtNum(st.calls + st.wa_taps))}
    ${k('إعلانات منشورة الآن', fmtNum(live.length))}${k('إعلانات بانتظار المراجعة', fmtNum((ads || []).filter(a => a.status === 'pending').length))}${k('إيراد الإعلانات المؤكد', fmtNum(adRev) + ' د.ك')}${k('إيراد الاشتراكات الفعّالة', fmtNum(st.revenue_active_kwd) + ' د.ك')}</div>
    <div class="panel"><h3>الزيارات والتواصل — آخر 30 يوم<span class="legend"><span><i></i>زوار فريدون</span><span><i class="y"></i>اتصال/واتساب</span></span></h3>
      <div class="bars">${days.map((d, i) => `<div class="b" title="${d}: ${visits[i]} زيارة / ${contacts[i]} تواصل"><span style="height:${visits[i] / max * 100}%"></span><span class="y" style="height:${contacts[i] / max * 100}%"></span>${i % 5 === 0 ? `<em>${d.slice(5)}</em>` : '<em>&nbsp;</em>'}</div>`).join('')}</div>
      <p style="color:var(--mut);font-size:12.5px;margin:10px 0 0">الأرقام فعلية من الخادم. الزائر يُحسب مرة واحدة يومياً لكل عنوان شبكة (بدون تخزين العنوان نفسه). تبدأ الإحصائيات من تاريخ تشغيل الواجهة الجديدة.</p></div>
    <div class="panel"><h3>الأعلى مشاهدة</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>مقدم الخدمة</th><th>القسم</th><th>مشاهدات</th><th>اتصال</th><th>واتساب</th></tr></thead><tbody>
      ${(top || []).map(c => `<tr><td>${esc(c.name)}</td><td>${esc(svcName(c.service_id))}</td><td>${fmtNum(c.visits)}</td><td>${fmtNum(c.calls)}</td><td>${fmtNum(c.wa_taps)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ---------------- مقدمو الخدمات ---------------- */
const CO_SEL = 'id,name,service_id,phone,whatsapp,price_text,description,logo_url,cover_url,status,is_active,is_sample,sub_start,sub_end,featured_until,is_24h,visits,calls,wa_taps,owner_id,created_at,lat,lng,address,company_areas(area_id)';
async function vCompanies(m) {
  const list = await rest(`companies?select=${CO_SEL}&order=created_at.desc`) || [];
  A.cache.cos = list;
  const f = A.cache.coFilter || 'all', q = A.cache.coQ || '';
  const filt = list.filter(c => (f === 'all' || (f === 'visible' && visible(c)) || (f === 'pending' && c.status === 'pending') || (f === 'stopped' && (!c.is_active || c.status === 'suspended')) || (f === 'expired' && c.status === 'approved' && c.sub_end < todayISO()) || (f === 'featured' && c.featured_until >= todayISO()))
    && (!q || norm(c.name + ' ' + c.phone + ' ' + svcName(c.service_id)).includes(norm(q))));
  const chip = (id, t) => `<button class="chip ${f === id ? 'on' : 'out'}" data-act="co-filter" data-v="${id}">${t}</button>`;
  m.innerHTML = head('مقدمو الخدمات', `<button class="btn sm primary" data-act="co-new">${icon('plus')}إضافة</button>`) +
    `<div class="toolbar"><input class="inp" id="coq" placeholder="بحث بالاسم أو الرقم" value="${esc(q)}">${chip('all', 'الكل ' + list.length)}${chip('visible', 'ظاهر')}${chip('pending', 'بانتظار')}${chip('expired', 'منتهي')}${chip('stopped', 'موقوف')}${chip('featured', 'مميز')}</div>
    <div class="rows">${filt.map(coRow).join('') || '<div class="empty"><b>لا توجد نتائج</b></div>'}</div>`;
  const i = $('#coq'); i.oninput = () => { clearTimeout(i._t); i._t = setTimeout(() => { A.cache.coQ = i.value; vCompanies(m).then(() => { const n = $('#coq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); }, 300); };
}
function coRow(c) {
  const feat = c.featured_until && c.featured_until >= todayISO();
  return `<div class="arow"><div class="top">${safeImg(c.logo_url) ? `<img src="${esc(safeImg(c.logo_url))}" alt="">` : `<span class="ph">${svcIcon(c.service_id)}</span>`}
    <div class="t"><b>${esc(c.name)}</b><small>#${c.id} · ${esc(svcName(c.service_id))} · <span dir="ltr">${esc(c.phone || '')}</span>${c.owner_id ? ' · له حساب' : ''}</small></div>${tgStatus(c)}</div>
    <div class="kvs"><span><b>الاشتراك:</b> ${fmtDate(c.sub_start)} ← ${fmtDate(c.sub_end)}</span><span><b>مشاهدات:</b> ${fmtNum(c.visits)}</span><span><b>اتصال:</b> ${fmtNum(c.calls)}</span><span><b>واتساب:</b> ${fmtNum(c.wa_taps)}</span>${feat ? `<span class="tg y">مميز حتى ${fmtDate(c.featured_until)}</span>` : ''}${c.is_sample ? '<span class="tg bad">تجريبي</span>' : ''}</div>
    <div class="btns">
      ${c.status !== 'approved' ? `<button class="btn xs primary" data-act="co-approve" data-id="${c.id}">${icon('check')}موافقة ونشر 30 يوم</button>` : ''}
      ${c.status === 'pending' ? `<button class="btn xs danger-soft" data-act="co-reject" data-id="${c.id}">رفض</button>` : ''}
      ${c.status === 'approved' ? `<button class="btn xs ghost" data-act="co-toggle" data-id="${c.id}">${c.is_active ? icon('pause') + 'إيقاف' : icon('play') + 'تفعيل'}</button><button class="btn xs ghost" data-act="co-extend" data-id="${c.id}">+30 يوم</button>` : ''}
      <button class="btn xs ghost" data-act="co-feature" data-id="${c.id}">${icon('star')}${feat ? 'إدارة التمييز' : 'تمييز'}</button>
      <button class="btn xs ghost" data-act="co-edit" data-id="${c.id}">${icon('edit')}تعديل</button>
      <button class="btn xs danger-soft" data-act="co-del" data-id="${c.id}">${icon('trash')}</button></div></div>`;
}
const coById = id => (A.cache.cos || []).find(c => c.id === +id);
function coForm(c = {}) {
  const ars = new Set((c.company_areas || []).map(x => x.area_id));
  return `<div class="sheet-h"><h3>${c.id ? 'تعديل مقدم الخدمة' : 'إضافة مقدم خدمة'}</h3><button class="icon-btn clear" data-close>${icon('close')}</button></div><div class="sheet-body">
    <div class="field"><label>الاسم</label><input class="inp" id="cn" maxlength="100" value="${esc(c.name || '')}"></div>
    <div class="field"><label>القسم</label><select class="inp" id="cs">${A.services.map(s => `<option value="${esc(s.id)}" ${s.id === c.service_id ? 'selected' : ''}>${esc(s.name_ar)}</option>`).join('')}</select></div>
    <div class="grid2"><div class="field"><label>هاتف الاتصال</label><input class="inp ltr" id="cp" inputmode="numeric" value="${esc(localPhone(c.phone) || c.phone || '')}"></div><div class="field"><label>واتساب</label><input class="inp ltr" id="cw" inputmode="numeric" value="${esc(localPhone(c.whatsapp) || c.whatsapp || '')}"></div></div>
    <div class="field"><label>المناطق</label><div class="wrapchips" id="car">${A.areas.map(a => `<button type="button" class="chip out ${ars.has(a.id) ? 'on' : ''}" data-v="${a.id}">${esc(a.name_ar)}</button>`).join('')}</div></div>
    <div class="field"><label>الأسعار</label><input class="inp" id="cpr" maxlength="120" value="${esc(c.price_text || '')}"></div>
    <div class="field"><label>الوصف</label><textarea class="inp" id="cd" maxlength="1500">${esc(c.description || '')}</textarea></div>
    <div class="field"><label>العنوان</label><input class="inp" id="cad" maxlength="200" value="${esc(c.address || '')}"></div>
    <button type="button" class="switch" id="c24"><span><b>متاح 24 ساعة</b></span><span class="tgl ${c.is_24h ? 'on' : ''}"></span></button>
    <div class="field"><label>الشعار</label><label class="upload"><input type="file" id="cl" accept="image/*"><span class="pv" id="clp">${safeImg(c.logo_url) ? `<img src="${esc(safeImg(c.logo_url))}" alt="">` : icon('image')}</span><span><b>تغيير الشعار</b></span></label></div>
    <div class="field"><label>صورة الغلاف</label><label class="upload wide"><input type="file" id="cc" accept="image/*"><span class="pv" id="ccp">${safeImg(c.cover_url) ? `<img src="${esc(safeImg(c.cover_url))}" alt="">` : icon('image')}</span><span><b>تغيير الغلاف</b></span></label></div>
    <button class="btn primary block" id="csave">حفظ</button></div>`;
}
function bindCoForm(sh, c = {}) {
  $$('#car .chip', sh).forEach(b => b.onclick = () => b.classList.toggle('on'));
  $('#c24', sh).onclick = e => $('.tgl', e.currentTarget).classList.toggle('on');
  const pv = (i, box) => { const f = i.files[0]; if (f) box.innerHTML = `<img src="${URL.createObjectURL(f)}" alt="">`; };
  $('#cl', sh).onchange = e => pv(e.target, $('#clp', sh)); $('#cc', sh).onchange = e => pv(e.target, $('#ccp', sh));
  $('#csave', sh).onclick = e => act(e.currentTarget, async () => {
    const ph = localPhone($('#cp', sh).value), wa = localPhone($('#cw', sh).value) || ph;
    if ($('#cn', sh).value.trim().length < 2) throw new Error('اكتب الاسم');
    if (!ph) throw new Error('invalid phone');
    const body = { name: $('#cn', sh).value.trim(), service_id: $('#cs', sh).value, phone: ph, whatsapp: wa, price_text: $('#cpr', sh).value.trim() || null, description: $('#cd', sh).value.trim() || null, address: $('#cad', sh).value.trim() || null, is_24h: $('#c24 .tgl', sh).classList.contains('on') };
    const lf = $('#cl', sh).files[0], cf = $('#cc', sh).files[0];
    if (lf) body.logo_url = await upload('logos', 'companies/' + rnd() + '.jpg', await shrinkImage(lf, 600));
    if (cf) body.cover_url = await upload('logos', 'covers/' + rnd() + '.jpg', await shrinkImage(cf, 1200, .78));
    let id = c.id;
    if (id) await patch('companies', id, body);
    else { const r = await rest('companies', { method: 'POST', body: Object.assign(body, { status: 'approved', is_active: true, is_sample: false, sub_start: todayISO(), sub_end: addDays(todayISO(), 30) }), prefer: 'return=representation' }); id = r[0].id; }
    const want = $$('#car .chip.on', sh).map(b => +b.dataset.v), had = (c.company_areas || []).map(x => x.area_id);
    const add = want.filter(x => !had.includes(x)), rem = had.filter(x => !want.includes(x));
    if (add.length) await rest('company_areas', { method: 'POST', body: add.map(a => ({ company_id: id, area_id: a })), prefer: 'return=minimal' });
    if (rem.length) await rest(`company_areas?company_id=eq.${id}&area_id=in.(${rem.join(',')})`, { method: 'DELETE' });
  }, 'تم الحفظ');
}

/* ---------------- طلبات الانضمام ---------------- */
async function vJoin(m) {
  const [pend, legacy] = await Promise.all([rest(`companies?select=${CO_SEL}&status=eq.pending&order=created_at.desc`), rest('join_requests?select=*&status=eq.new&order=created_at.desc')]);
  A.cache.cos = pend || []; A.cache.jr = legacy || [];
  m.innerHTML = head('طلبات الانضمام') +
    `<div class="panel"><h3>طلبات من حسابات مقدمي الخدمة (${(pend || []).length})</h3><div class="rows">${(pend || []).map(coRow).join('') || '<p style="color:var(--mut);margin:0">لا توجد طلبات جديدة.</p>'}</div></div>
     <div class="panel"><h3>طلبات النموذج القديم (${(legacy || []).length})</h3><div class="rows">${(legacy || []).map(r => `<div class="arow"><div class="top">${safeImg(r.logo_url) ? `<img src="${esc(safeImg(r.logo_url))}" alt="">` : `<span class="ph">${svcIcon(r.service_id)}</span>`}<div class="t"><b>${esc(r.company_name)}</b><small>${esc(svcName(r.service_id))} · ${esc(r.area_name || '')} · <span dir="ltr">${esc(r.phone)}</span> · ${fmtDate(r.created_at)}</small></div></div>
       <div class="btns"><button class="btn xs primary" data-act="jr-accept" data-id="${r.id}">${icon('check')}قبول وإضافة (30 يوم)</button><button class="btn xs danger-soft" data-act="jr-reject" data-id="${r.id}">رفض</button><a class="btn xs wa" target="_blank" rel="noopener" href="https://wa.me/${intlPhone(r.phone)}">${icon('wa')}تواصل</a></div></div>`).join('') || '<p style="color:var(--mut);margin:0">لا توجد طلبات جديدة.</p>'}</div></div>`;
}

/* ---------------- الإعلانات ---------------- */
const AD_T = { home_banner: 'بانر الرئيسية', category_banner: 'بانر قسم', featured: 'مقدم خدمة مميز' };
function adState(a) {
  const now = Date.now();
  if (a.status === 'pending') return ['warn', 'بانتظار المراجعة'];
  if (a.status === 'rejected') return ['bad', 'مرفوض'];
  if (a.status === 'paused') return ['warn', 'موقوف'];
  if (a.status === 'ended' || (a.ends_at && Date.parse(a.ends_at) <= now)) return ['', 'منتهي'];
  if (a.payment_status !== 'paid') return ['warn', 'مقبول — الدفع غير مؤكد (غير ظاهر)'];
  if (Date.parse(a.starts_at) > now) return ['', 'مجدول'];
  return ['ok', 'منشور الآن'];
}
async function vAds(m) {
  const [list0, ap] = await Promise.all([rest('ad_campaigns?select=*&order=created_at.desc'), rest('app_settings?select=value&key=eq.ad_prices').catch(() => [])]);
  const list = list0 || [];
  A.cache.ads = list; A.cache.adPrices = (ap && ap[0] && ap[0].value) || {};
  const f = A.cache.adFilter || 'all';
  const fl = list.filter(a => f === 'all' || (f === 'pending' && a.status === 'pending') || (f === 'live' && adState(a)[1] === 'منشور الآن') || (f === 'unpaid' && a.status === 'approved' && a.payment_status !== 'paid') || (f === 'done' && ['rejected', 'ended'].includes(a.status)));
  const chip = (id, t) => `<button class="chip ${f === id ? 'on' : 'out'}" data-act="ad-filter" data-v="${id}">${t}</button>`;
  m.innerHTML = head('الإعلانات') + `<div class="note y" style="margin-bottom:12px">${icon('info')}<div>الإعلان يظهر للعامة فقط إذا: <b>تمت الموافقة</b> + <b>الدفع مؤكد</b> + التاريخ الحالي داخل مدة الإعلان. المشاهدات والنقرات فعلية (مرة يومياً لكل زائر).</div></div>
    <div class="toolbar">${chip('all', 'الكل ' + list.length)}${chip('pending', 'بانتظار المراجعة')}${chip('unpaid', 'بانتظار الدفع')}${chip('live', 'منشور')}${chip('done', 'منتهي/مرفوض')}</div>
    <div class="rows">${fl.map(a => { const [k, t] = adState(a); const ctr = a.views ? (a.clicks / a.views * 100).toFixed(1) + '%' : '—'; return `<div class="arow">
      <img class="ad-img" src="${esc(safeImg(a.image_url))}" alt="" loading="lazy">
      <div class="top"><div class="t"><b>${esc(a.title || a.advertiser_name)}</b><small>#${a.id} · ${esc(AD_T[a.ad_type])}${a.service_id ? ' · ' + esc(svcName(a.service_id)) : ''}${a.company_id ? ' · مقدم #' + a.company_id : ''}</small></div><span class="tg ${k}">${esc(t)}</span></div>
      <div class="kvs"><span><b>المعلن:</b> ${esc(a.advertiser_name)} (${a.advertiser_kind === 'company' ? 'شركة' : 'فرد'})</span><span><b>الهاتف:</b> <a dir="ltr" href="tel:+${intlPhone(a.phone)}">${esc(a.phone)}</a></span><span><b>المدة:</b> ${a.duration_days} يوم</span>
        <span><b>الدفع:</b> ${a.payment_status === 'paid' ? `مؤكد ${a.amount_kwd != null ? fmtNum(a.amount_kwd) + ' د.ك' : ''} ${a.payment_ref ? '(' + esc(a.payment_ref) + ')' : ''}` : 'غير مؤكد'}</span>
        ${a.starts_at ? `<span><b>من</b> ${fmtDate(a.starts_at)} <b>إلى</b> ${fmtDate(a.ends_at)}</span>` : ''}<span><b>مشاهدات:</b> ${fmtNum(a.views)}</span><span><b>نقرات:</b> ${fmtNum(a.clicks)}</span><span><b>CTR:</b> ${ctr}</span>
        ${a.notes ? `<span><b>ملاحظات المعلن:</b> ${esc(a.notes)}</span>` : ''}${a.admin_note ? `<span><b>ملاحظة الإدارة:</b> ${esc(a.admin_note)}</span>` : ''}${a.reject_reason ? `<span><b>سبب الرفض:</b> ${esc(a.reject_reason)}</span>` : ''}</div>
      <div class="btns">
        ${a.payment_status !== 'paid' ? `<button class="btn xs dark" data-act="ad-pay" data-id="${a.id}">${icon('card')}تأكيد الدفع</button>` : `<button class="btn xs ghost" data-act="ad-unpay" data-id="${a.id}">إلغاء تأكيد الدفع</button>`}
        ${['pending', 'rejected', 'paused', 'ended'].includes(a.status) ? `<button class="btn xs primary" data-act="ad-approve" data-id="${a.id}">${icon('check')}${a.status === 'paused' ? 'استئناف' : 'موافقة وتحديد المدة'}</button>` : ''}
        ${a.status === 'approved' ? `<button class="btn xs ghost" data-act="ad-dates" data-id="${a.id}">${icon('clock')}تعديل المدة</button><button class="btn xs ghost" data-act="ad-pause" data-id="${a.id}">${icon('pause')}إيقاف</button><button class="btn xs ghost" data-act="ad-end" data-id="${a.id}">إنهاء</button>` : ''}
        ${a.status === 'pending' ? `<button class="btn xs danger-soft" data-act="ad-reject" data-id="${a.id}">رفض</button>` : ''}
        <button class="btn xs ghost" data-act="ad-stats" data-id="${a.id}">${icon('chart')}إحصائيات يومية</button>
        <a class="btn xs wa" target="_blank" rel="noopener" href="https://wa.me/${intlPhone(a.phone)}?text=${encodeURIComponent('السلام عليكم، بخصوص طلب إعلانكم في ماتعطل #' + a.id)}">${icon('wa')}تواصل</a>
        <button class="btn xs danger-soft" data-act="ad-del" data-id="${a.id}">${icon('trash')}</button></div></div>`; }).join('') || '<div class="empty"><div class="big">' + icon('megaphone') + '</div><b>لا توجد طلبات إعلان</b></div>'}</div>`;
}
const adById = id => (A.cache.ads || []).find(a => a.id === +id);
const dtLocal = iso => { const d = iso ? new Date(iso) : new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
function adDatesSheet(a, approve) {
  const s0 = dtLocal(a.starts_at), e0 = a.ends_at ? dtLocal(a.ends_at) : addDays(s0, a.duration_days);
  sheet(`<div class="sheet-h"><h3>${approve ? 'موافقة وتحديد المدة' : 'تعديل مدة الإعلان'}</h3><button class="icon-btn clear" data-close>${icon('close')}</button></div><div class="sheet-body">
    <div class="grid2"><div class="field"><label>تاريخ البداية</label><input class="inp" type="date" id="ds" value="${s0}"></div><div class="field"><label>تاريخ النهاية</label><input class="inp" type="date" id="de" value="${e0}"></div></div>
    <span class="hint" style="font-size:12.5px;color:var(--mut)">المدة المطلوبة من المعلن: ${a.duration_days} يوم. ينتهي الإعلان تلقائياً بنهاية التاريخ المحدد.</span>
    <div class="field"><label>ملاحظة داخلية (اختياري)</label><input class="inp" id="dn" maxlength="500" value="${esc(a.admin_note || '')}"></div>
    ${a.payment_status !== 'paid' ? `<div class="note y">${icon('info')}<div>الدفع غير مؤكد — الإعلان لن يظهر حتى تأكيد الدفع.</div></div>` : ''}
    <button class="btn primary block" id="dsave">حفظ</button></div>`, {
    onOpen: sh => { $('#ds', sh).onchange = () => { $('#de', sh).value = addDays($('#ds', sh).value, a.duration_days); }; $('#dsave', sh).onclick = e => act(e.currentTarget, async () => {
      const s = $('#ds', sh).value, en = $('#de', sh).value; if (!s || !en || en <= s) throw new Error('تاريخ النهاية لازم يكون بعد البداية');
      const startIso = s === todayISO() ? new Date().toISOString() : new Date(s + 'T00:00:00+03:00').toISOString();
      await patch('ad_campaigns', a.id, { status: 'approved', starts_at: startIso, ends_at: new Date(en + 'T23:59:59+03:00').toISOString(), admin_note: $('#dn', sh).value.trim() || null });
    }, 'تم الحفظ'); }
  });
}

/* ---------------- الاشتراكات والمدفوعات ---------------- */
async function vSubs(m) {
  const [subs, pays, plans, cos, ap] = await Promise.all([
    rest('subscriptions?select=*,companies(name)&order=created_at.desc&limit=200'), rest('payments?select=*&order=created_at.desc&limit=200'),
    rest('subscription_plans?select=*&order=sort.asc'), rest('companies?select=id,name,sub_end,status&order=name.asc'),
    rest('app_settings?select=value&key=eq.ad_prices')]);
  A.cache.plans = plans || []; A.cache.allCos = cos || []; A.cache.subs = subs || [];
  const prices = (ap && ap[0] && ap[0].value) || {};
  const PT = { home_banner: 'بانر الرئيسية', category_banner: 'بانر قسم', featured: 'مقدم مميز' }, DD = [7, 14, 30, 60, 90];
  const priceTable = `<div class="panel"><h3>أسعار الإعلانات (د.ك) <button class="btn xs primary" data-act="adprice-save">${icon('check')}حفظ الأسعار</button></h3><div class="tbl-wrap"><table class="tbl" id="ptbl"><thead><tr><th>النوع</th>${DD.map(d => `<th>${d} يوم</th>`).join('')}</tr></thead><tbody>
    ${Object.entries(PT).map(([k, t]) => `<tr><td><b>${t}</b></td>${DD.map(d => `<td><input class="inp" style="height:38px;width:76px;font-size:14px;padding:0 8px" type="number" min="0" step="0.5" data-t="${k}" data-d="${d}" value="${esc((prices[k] || {})[d] ?? '')}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p style="color:var(--mut);font-size:12.5px;margin:8px 0 0">تظهر هذه الأسعار للمعلن في صفحة «أعلن معنا»، وتُعبّأ تلقائياً عند تأكيد الدفع.</p></div>`;
  const st = { pending: ['warn', 'بانتظار الدفع'], active: ['ok', 'فعّال'], expired: ['', 'منتهي'], cancelled: ['bad', 'ملغي'] };
  m.innerHTML = head('الاشتراكات والمدفوعات', `<button class="btn sm primary" data-act="sub-new">${icon('plus')}اشتراك جديد</button>`) +
    priceTable + `<div class="panel"><h3>باقات اشتراك مقدمي الخدمة <button class="btn xs ghost" data-act="plan-new">${icon('plus')}باقة</button></h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الباقة</th><th>المدة</th><th>السعر</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${(plans || []).map(p => `<tr><td>${esc(p.name_ar)}</td><td>${p.months} شهر</td><td>${fmtNum(p.price_kwd)} د.ك</td><td>${p.is_active ? '<span class="tg ok">فعّالة</span>' : '<span class="tg">متوقفة</span>'}</td><td><button class="btn xs ghost" data-act="plan-edit" data-id="${esc(p.id)}">${icon('edit')}</button></td></tr>`).join('')}</tbody></table></div></div>
    <div class="panel"><h3>الاشتراكات (${(subs || []).length})</h3>${(subs || []).length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>مقدم الخدمة</th><th>المبلغ</th><th>من</th><th>إلى</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${subs.map(s => `<tr><td>${s.id}</td><td>${esc((s.companies && s.companies.name) || '#' + s.company_id)}</td><td>${fmtNum(s.amount_kwd)} د.ك</td><td>${fmtDate(s.starts_on)}</td><td>${fmtDate(s.ends_on)}</td><td><span class="tg ${(st[s.status] || [])[0]}">${(st[s.status] || [, s.status])[1]}</span></td><td>${s.status === 'pending' ? `<button class="btn xs primary" data-act="sub-activate" data-id="${s.id}">تأكيد الدفع والتفعيل</button> <button class="btn xs ghost" data-act="sub-cancel" data-id="${s.id}">إلغاء</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p style="color:var(--mut);margin:0">لا توجد اشتراكات مسجّلة بعد. التمديد السريع (+30 يوم) من صفحة مقدمي الخدمات لا يُنشئ سجل دفع؛ استخدم «اشتراك جديد» لتوثيق المدفوعات.</p>'}</div>
    <div class="panel"><h3>المدفوعات (${(pays || []).length})</h3>${(pays || []).length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>اشتراك</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>
      ${pays.map(p => `<tr><td>${p.id}</td><td>#${p.subscription_id}</td><td>${fmtNum(p.amount_kwd)} د.ك</td><td>${esc(p.provider)}</td><td>${esc(p.provider_ref || '—')}</td><td>${esc(p.status)}</td><td>${fmtDate(p.paid_at || p.created_at)}</td></tr>`).join('')}</tbody></table></div>` : '<p style="color:var(--mut);margin:0">لا توجد مدفوعات مسجّلة.</p>'}</div>`;
}

/* ---------------- الأقسام والمناطق ---------------- */
async function vCatalog(m) {
  const [sv, ar] = await Promise.all([rest('services?select=*&order=sort.asc'), rest('areas?select=*&order=id.asc')]);
  A.services = sv || []; A.areas = ar || [];
  m.innerHTML = head('الأقسام والمناطق') + `
    <div class="panel"><h3>أقسام الخدمات <button class="btn xs primary" data-act="svc-new">${icon('plus')}قسم</button></h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>الاسم</th><th>المعرّف</th><th>الترتيب</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${A.services.map(s => `<tr><td>${svcIcon(s)}</td><td>${esc(s.name_ar)}</td><td dir="ltr">${esc(s.id)}</td><td>${s.sort}</td><td>${s.is_active ? '<span class="tg ok">ظاهر</span>' : '<span class="tg">مخفي</span>'}</td><td><button class="btn xs ghost" data-act="svc-edit" data-id="${esc(s.id)}">${icon('edit')}</button></td></tr>`).join('')}</tbody></table></div></div>
    <div class="panel"><h3>المناطق <button class="btn xs primary" data-act="area-new">${icon('plus')}منطقة</button></h3><div class="wrapchips">${A.areas.map(a => `<button class="chip out" data-act="area-edit" data-id="${a.id}">${icon('pin')}${esc(a.name_ar)}</button>`).join('')}</div>
      <p style="color:var(--mut);font-size:12.5px;margin:10px 0 0">إعادة تسمية المنطقة تنعكس على كل مقدمي الخدمة المرتبطين بها.</p></div>`;
}
const SVC_ICONS = ['tow', 'tire', 'key', 'wash', 'shield', 'battery', 'wrench', 'grid'];
function svcSheet(s = {}) {
  sheet(`<div class="sheet-h"><h3>${s.id ? 'تعديل القسم' : 'قسم جديد'}</h3><button class="icon-btn clear" data-close>${icon('close')}</button></div><div class="sheet-body">
    ${s.id ? '' : '<div class="field"><label>المعرّف (إنجليزي بدون مسافات)</label><input class="inp ltr" id="si" maxlength="20" placeholder="glass"></div>'}
    <div class="field"><label>الاسم</label><input class="inp" id="sn" maxlength="60" value="${esc(s.name_ar || '')}"></div>
    <div class="grid2"><div class="field"><label>الترتيب</label><input class="inp" id="so" type="number" value="${s.sort ?? 50}"></div><div class="field"><label>الأيقونة</label><select class="inp" id="sic">${SVC_ICONS.map(i => `<option ${s.icon === i ? 'selected' : ''}>${i}</option>`).join('')}</select></div></div>
    <button type="button" class="switch" id="sa"><span><b>ظاهر للعملاء</b></span><span class="tgl ${s.is_active !== false ? 'on' : ''}"></span></button>
    <button class="btn primary block" id="ss">حفظ</button></div>`, {
    onOpen: sh => { $('#sa', sh).onclick = e => $('.tgl', e.currentTarget).classList.toggle('on'); $('#ss', sh).onclick = e => act(e.currentTarget, async () => {
      const body = { name_ar: $('#sn', sh).value.trim(), sort: +$('#so', sh).value || 0, icon: $('#sic', sh).value, is_active: $('#sa .tgl', sh).classList.contains('on') };
      if (body.name_ar.length < 2) throw new Error('اكتب الاسم');
      if (s.id) await patch('services', s.id, body);
      else { const id = $('#si', sh).value.trim().toLowerCase(); if (!/^[a-z][a-z0-9_-]{1,19}$/.test(id)) throw new Error('المعرّف غير صالح'); await rest('services', { method: 'POST', body: Object.assign({ id }, body), prefer: 'return=minimal' }); }
    }, 'تم الحفظ'); }
  });
}

/* ---------------- البنرات والمحتوى ---------------- */
async function vContent(m) {
  const [bn, set] = await Promise.all([rest('banners?select=*&order=sort.asc'), rest('app_settings?select=key,value,is_public&key=in.(support_whatsapp,maintenance_message)')]);
  A.cache.banners = bn || [];
  const sv = k => ((set || []).find(x => x.key === k) || {}).value;
  m.innerHTML = head('البنرات والمحتوى', `<button class="btn sm primary" data-act="bn-new">${icon('plus')}بانر</button>`) + `
    <div class="panel"><h3>بنرات الإدارة (تظهر في الصفحة الرئيسية)</h3><div class="rows">${(bn || []).map(b => `<div class="arow">${safeImg(b.image_url) ? `<img class="ad-img" src="${esc(safeImg(b.image_url))}" alt="">` : ''}<div class="top"><div class="t"><b>${esc(b.title)}</b><small>${esc(b.subtitle || '')} · ترتيب ${b.sort}${b.company_id ? ' · يفتح مقدم #' + b.company_id : ''}</small></div>${b.is_active ? '<span class="tg ok">فعّال</span>' : '<span class="tg">متوقف</span>'}</div>
      <div class="kvs"><span><b>من</b> ${fmtDate(b.starts_at)} <b>إلى</b> ${b.ends_at ? fmtDate(b.ends_at) : 'مفتوح'}</span></div>
      <div class="btns"><button class="btn xs ghost" data-act="bn-edit" data-id="${b.id}">${icon('edit')}تعديل</button><button class="btn xs ghost" data-act="bn-toggle" data-id="${b.id}">${b.is_active ? 'إيقاف' : 'تفعيل'}</button><button class="btn xs danger-soft" data-act="bn-del" data-id="${b.id}">${icon('trash')}</button></div></div>`).join('') || '<p style="color:var(--mut);margin:0">لا توجد بنرات. عند عدم وجود بنرات أو إعلانات، يعرض التطبيق بطاقات ماتعطل التعريفية (أعلن معنا / انضم الآن).</p>'}</div></div>
    <div class="panel"><h3>إعدادات المحتوى</h3><div class="form" style="padding:0">
      <div class="field"><label>رقم واتساب الدعم</label><input class="inp ltr" id="swa" value="${esc(digits(sv('support_whatsapp')))}"></div>
      <div class="field"><label>رسالة تنبيه أعلى الصفحة الرئيسية (اتركها فارغة للإخفاء)</label><input class="inp" id="smm" maxlength="200" value="${esc(sv('maintenance_message') || '')}"></div>
      <button class="btn primary" data-act="settings-save">حفظ الإعدادات</button></div></div>`;
}
function bnSheet(b = {}) {
  sheet(`<div class="sheet-h"><h3>${b.id ? 'تعديل بانر' : 'بانر جديد'}</h3><button class="icon-btn clear" data-close>${icon('close')}</button></div><div class="sheet-body">
    <div class="field"><label>العنوان</label><input class="inp" id="bt" maxlength="80" value="${esc(b.title || '')}"></div>
    <div class="field"><label>نص فرعي</label><input class="inp" id="bs" maxlength="120" value="${esc(b.subtitle || '')}"></div>
    <div class="field"><label>الصورة (1200×510)</label><label class="upload wide"><input type="file" id="bi" accept="image/*"><span class="pv" id="bip">${safeImg(b.image_url) ? `<img src="${esc(safeImg(b.image_url))}" alt="">` : icon('image')}</span><span><b>اختر صورة</b></span></label></div>
    <div class="grid2"><div class="field"><label>يفتح مقدم خدمة رقم (اختياري)</label><input class="inp" id="bc" type="number" value="${b.company_id || ''}"></div><div class="field"><label>الترتيب</label><input class="inp" id="bo" type="number" value="${b.sort ?? 0}"></div></div>
    <div class="grid2"><div class="field"><label>يبدأ</label><input class="inp" type="date" id="bsd" value="${dtLocal(b.starts_at)}"></div><div class="field"><label>ينتهي (اختياري)</label><input class="inp" type="date" id="bed" value="${b.ends_at ? dtLocal(b.ends_at) : ''}"></div></div>
    <button class="btn primary block" id="bsave">حفظ</button></div>`, {
    onOpen: sh => { $('#bi', sh).onchange = e => { const f = e.target.files[0]; if (f) $('#bip', sh).innerHTML = `<img src="${URL.createObjectURL(f)}" alt="">`; };
      $('#bsave', sh).onclick = e => act(e.currentTarget, async () => {
        const body = { title: $('#bt', sh).value.trim(), subtitle: $('#bs', sh).value.trim() || null, company_id: +$('#bc', sh).value || null, sort: +$('#bo', sh).value || 0,
          starts_at: new Date($('#bsd', sh).value + 'T00:00:00+03:00').toISOString(), ends_at: $('#bed', sh).value ? new Date($('#bed', sh).value + 'T23:59:59+03:00').toISOString() : null };
        if (body.title.length < 2) throw new Error('اكتب العنوان');
        const f = $('#bi', sh).files[0]; if (f) body.image_url = await upload('logos', 'banners/' + rnd() + '.jpg', await shrinkImage(f, 1400, .8));
        if (!b.id && !body.image_url) throw new Error('اختر صورة');
        if (b.id) await patch('banners', b.id, body); else await rest('banners', { method: 'POST', body: Object.assign(body, { is_active: true }), prefer: 'return=minimal' });
      }, 'تم الحفظ'); }
  });
}

/* ---------------- المستخدمون ---------------- */
async function vUsers(m) {
  const list = await rest('profiles?select=id,full_name,phone,role,created_at&order=created_at.desc&limit=500') || [];
  const R = { customer: 'عميل', company: 'مقدم خدمة', staff: 'مشرف', admin: 'مدير' };
  m.innerHTML = head('المستخدمون') + `<div class="note" style="margin-bottom:12px">${icon('shieldc')}<div>أرقام الهواتف <b>غير موثّقة</b> (التسجيل بدون SMS). منح صلاحية «مدير» متاح للمالك فقط، وحساب المالك محمي من التعديل في الخادم.</div></div>
    <div class="panel"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الاسم</th><th>الهاتف (غير موثّق)</th><th>الدور</th><th>التسجيل</th><th></th></tr></thead><tbody>
    ${list.map(u => `<tr><td>${esc(u.full_name || '—')}</td><td dir="ltr" style="text-align:right">${esc(u.phone || '—')}</td><td><span class="tg ${u.role === 'admin' ? 'y' : ''}">${R[u.role] || u.role}</span></td><td>${fmtDate(u.created_at)}</td><td>${u.id !== session().uid ? `<select class="inp" style="height:36px;font-size:13px;width:auto" data-role="${u.id}">${Object.entries(R).map(([k, t]) => `<option value="${k}" ${k === u.role ? 'selected' : ''}>${t}</option>`).join('')}</select>` : '<small style="color:var(--mut)">أنت</small>'}</td></tr>`).join('')}</tbody></table></div></div>`;
  $$('[data-role]', m).forEach(s => s.onchange = async () => { if (!(await confirmBox('تغيير صلاحية هذا المستخدم؟'))) { s.value = list.find(u => u.id === s.dataset.role).role; return; } try { await rpc('admin_set_role', { p_user: s.dataset.role, p_role: s.value }); toast('تم التحديث', 'ok'); } catch (e) { toast(errText(e), 'err'); show(); } });
}

const VIEWS = { overview: vOverview, companies: vCompanies, join: vJoin, ads: vAds, subs: vSubs, catalog: vCatalog, content: vContent, users: vUsers };

/* ---------------- الإجراءات ---------------- */
const promptSheet = (title, fields, onSave) => sheet(`<div class="sheet-h"><h3>${esc(title)}</h3><button class="icon-btn clear" data-close>${icon('close')}</button></div><div class="sheet-body">${fields}<button class="btn primary block" id="psave">حفظ</button></div>`, { onOpen: sh => { $$('.switch', sh).forEach(w => w.onclick = () => $('.tgl', w).classList.toggle('on')); $('#psave', sh).onclick = e => onSave(sh, e.currentTarget); } });
const ACT = {
  reload: () => show(),
  logout: async (el, e) => { e.preventDefault(); await logout(); loginView(); },
  'co-filter': el => { A.cache.coFilter = el.dataset.v; show(); },
  'co-new': () => { const sh = sheet(coForm()); bindCoForm(sh); },
  'co-edit': el => { const c = coById(el.dataset.id); const sh = sheet(coForm(c)); bindCoForm(sh, c); },
  'co-approve': el => act(el, () => { const c = coById(el.dataset.id); return patch('companies', c.id, { status: 'approved', is_active: true, sub_start: todayISO(), sub_end: c.sub_end && c.sub_end >= todayISO() ? c.sub_end : addDays(todayISO(), 30) }); }, 'تمت الموافقة والنشر'),
  'co-reject': async el => { if (await confirmBox('رفض طلب الانضمام؟', { ok: 'رفض', danger: true })) act(el, () => patch('companies', +el.dataset.id, { status: 'rejected', is_active: false }), 'تم الرفض'); },
  'co-toggle': el => act(el, () => { const c = coById(el.dataset.id); return patch('companies', c.id, { is_active: !c.is_active }); }, 'تم التحديث'),
  'co-extend': el => act(el, () => { const c = coById(el.dataset.id); const b = c.sub_end < todayISO() ? todayISO() : c.sub_end; return patch('companies', c.id, { sub_end: addDays(b, 30), is_active: true }); }, 'تم التمديد 30 يوم'),
  'co-feature': el => { const c = coById(el.dataset.id); promptSheet('تمييز مقدم الخدمة', `<div class="field"><label>مميز حتى تاريخ (فارغ = إلغاء التمييز)</label><input class="inp" type="date" id="fu" value="${c.featured_until || addDays(todayISO(), 30)}"></div>`, (sh, b) => act(b, () => patch('companies', c.id, { featured_until: $('#fu', sh).value || null }), 'تم الحفظ')); },
  'co-del': async el => { const c = coById(el.dataset.id); if (!(await confirmBox(`حذف «${c.name}» نهائياً؟ يُفضّل «إيقاف» بدلاً من الحذف للحفاظ على البيانات.`, { ok: 'حذف نهائي', danger: true }))) return; act(el, async () => { await rest('company_areas?company_id=eq.' + c.id, { method: 'DELETE' }); const r = await rest('companies?id=eq.' + c.id, { method: 'DELETE', prefer: 'return=representation' }); if (!r || !r.length) throw new Error('forbidden'); }, 'تم الحذف'); },
  'jr-accept': el => act(el, async () => {
    const q = A.cache.jr.find(x => x.id === +el.dataset.id); const ph = localPhone(q.phone) || digits(q.phone);
    const r = await rest('companies', { method: 'POST', prefer: 'return=representation', body: { service_id: q.service_id, name: q.company_name, phone: ph, whatsapp: ph, is_active: true, status: 'approved', is_sample: false, sub_start: todayISO(), sub_end: addDays(todayISO(), 30), logo_url: q.logo_url || null } });
    const ar = A.areas.find(a => a.name_ar === q.area_name); if (ar) await rest('company_areas', { method: 'POST', body: { company_id: r[0].id, area_id: ar.id }, prefer: 'return=minimal' });
    await patch('join_requests', q.id, { status: 'accepted' });
  }, 'تمت الإضافة باشتراك 30 يوم'),
  'jr-reject': async el => { if (await confirmBox('رفض الطلب؟', { ok: 'رفض', danger: true })) act(el, () => patch('join_requests', +el.dataset.id, { status: 'rejected' }), 'تم الرفض'); },
  'ad-filter': el => { A.cache.adFilter = el.dataset.v; show(); },
  'ad-pay': el => { const a = adById(el.dataset.id); promptSheet('تأكيد استلام الدفع', `<div class="grid2"><div class="field"><label>المبلغ (د.ك)</label><input class="inp" id="pa" type="number" step="0.001" min="0" value="${a.amount_kwd ?? ((A.cache.adPrices || {})[a.ad_type] || {})[a.duration_days] ?? ''}"></div><div class="field"><label>مرجع الدفع (اختياري)</label><input class="inp" id="pr" maxlength="120" value="${esc(a.payment_ref || '')}" placeholder="رقم التحويل / KNET"></div></div><div class="note y">${icon('info')}<div>أكّد فقط بعد استلام المبلغ فعلياً.</div></div>`,
    (sh, b) => act(b, () => { const v = $('#pa', sh).value; if (v === '' || +v < 0) throw new Error('اكتب المبلغ'); return patch('ad_campaigns', a.id, { payment_status: 'paid', amount_kwd: +v, payment_ref: $('#pr', sh).value.trim() || null }); }, 'تم تأكيد الدفع')); },
  'ad-unpay': async el => { if (await confirmBox('إلغاء تأكيد الدفع؟ سيختفي الإعلان فوراً.', { danger: true })) act(el, () => patch('ad_campaigns', +el.dataset.id, { payment_status: 'unpaid' }), 'تم'); },
  'ad-approve': el => { const a = adById(el.dataset.id); if (a.status === 'paused' && a.ends_at && Date.parse(a.ends_at) > Date.now()) return act(el, () => patch('ad_campaigns', a.id, { status: 'approved' }), 'تم الاستئناف'); adDatesSheet(Object.assign({}, a, a.status === 'paused' ? {} : { starts_at: null, ends_at: null }), true); },
  'ad-dates': el => adDatesSheet(adById(el.dataset.id), false),
  'ad-pause': el => act(el, () => patch('ad_campaigns', +el.dataset.id, { status: 'paused' }), 'تم الإيقاف'),
  'ad-end': async el => { if (await confirmBox('إنهاء الإعلان الآن؟', { danger: true })) act(el, () => patch('ad_campaigns', +el.dataset.id, { status: 'ended' }), 'تم الإنهاء'); },
  'ad-reject': el => promptSheet('رفض الإعلان', '<div class="field"><label>سبب الرفض (يظهر للمعلن)</label><textarea class="inp" id="rr" maxlength="300"></textarea></div>', (sh, b) => act(b, () => { const r = $('#rr', sh).value.trim(); if (!r) throw new Error('reject reason required'); return patch('ad_campaigns', +el.dataset.id, { status: 'rejected', reject_reason: r }); }, 'تم الرفض')),
  'ad-del': async el => { if (await confirmBox('حذف طلب الإعلان نهائياً؟', { ok: 'حذف', danger: true })) act(el, async () => { const r = await rest('ad_campaigns?id=eq.' + (+el.dataset.id), { method: 'DELETE', prefer: 'return=representation' }); if (!r || !r.length) throw new Error('forbidden'); }, 'تم الحذف'); },
  'ad-stats': async el => {
    const a = adById(el.dataset.id); let rows = [];
    try { rows = await rest(`ad_stats_daily?select=day,views,clicks&ad_id=eq.${a.id}&order=day.desc&limit=90`) || []; } catch (e) { return toast(errText(e), 'err'); }
    sheet(`<div class="sheet-h"><h3>إحصائيات الإعلان #${a.id}</h3><button class="icon-btn clear" data-close>${icon('close')}</button></div><div class="sheet-body">
      <div class="stats3"><div><b>${fmtNum(a.views)}</b><small>مشاهدة</small></div><div><b>${fmtNum(a.clicks)}</b><small>نقرة</small></div><div><b>${a.views ? (a.clicks / a.views * 100).toFixed(1) + '%' : '—'}</b><small>CTR</small></div></div>
      ${rows.length ? `<table class="tbl"><thead><tr><th>اليوم</th><th>مشاهدات</th><th>نقرات</th></tr></thead><tbody>${rows.map(r => `<tr><td>${fmtDate(r.day)}</td><td>${fmtNum(r.views)}</td><td>${fmtNum(r.clicks)}</td></tr>`).join('')}</tbody></table>` : '<p style="color:var(--mut)">لا توجد بيانات بعد — تبدأ عند نشر الإعلان.</p>'}</div>`);
  },
  'sub-new': () => promptSheet('اشتراك جديد', `<div class="field"><label>مقدم الخدمة</label><select class="inp" id="sc">${A.cache.allCos.map(c => `<option value="${c.id}">${esc(c.name)} (#${c.id})</option>`).join('')}</select></div>
    <div class="field"><label>الباقة</label><select class="inp" id="sp">${A.cache.plans.map(p => `<option value="${esc(p.id)}" data-m="${p.months}" data-p="${p.price_kwd}">${esc(p.name_ar)} — ${fmtNum(p.price_kwd)} د.ك</option>`).join('')}</select></div>
    <div class="grid2"><div class="field"><label>المبلغ (د.ك)</label><input class="inp" id="sa" type="number" step="0.001" value="${(A.cache.plans[0] || {}).price_kwd ?? ''}"></div><div class="field"><label>يبدأ</label><input class="inp" id="ss" type="date" value="${todayISO()}"></div></div>
    <button type="button" class="switch" id="spaid"><span><b>تم استلام الدفع</b><small>يُفعّل الاشتراك ويُظهر مقدم الخدمة مباشرة</small></span><span class="tgl"></span></button>
    <div class="field"><label>مرجع الدفع (اختياري)</label><input class="inp" id="sr" maxlength="120"></div>`, (sh, b) => {
    const opt = $('#sp option:checked', sh); const months = +opt.dataset.m; const st = $('#ss', sh).value; const d = new Date(st + 'T00:00:00'); d.setMonth(d.getMonth() + months);
    const ends = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    act(b, async () => {
      const r = await rest('subscriptions', { method: 'POST', prefer: 'return=representation', body: { company_id: +$('#sc', sh).value, plan_id: $('#sp', sh).value, amount_kwd: +$('#sa', sh).value || 0, starts_on: st, ends_on: ends, status: 'pending', payment_note: 'أضيف من لوحة الإدارة' } });
      if ($('#spaid .tgl', sh).classList.contains('on')) await rpc('admin_activate_subscription', { p_id: r[0].id, p_note: 'تأكيد يدوي من لوحة الإدارة', p_provider: 'manual', p_ref: $('#sr', sh).value.trim() || null });
    }, 'تم الحفظ');
  }),
  'sub-activate': el => promptSheet('تأكيد الدفع وتفعيل الاشتراك', `<div class="field"><label>طريقة الدفع</label><select class="inp" id="pp"><option value="manual">يدوي / تحويل</option><option value="knet">KNET</option><option value="myfatoorah">MyFatoorah</option><option value="tap">Tap</option><option value="upayments">UPayments</option><option value="other">أخرى</option></select></div><div class="field"><label>المرجع</label><input class="inp" id="pr" maxlength="120"></div>`,
    (sh, b) => act(b, () => rpc('admin_activate_subscription', { p_id: +el.dataset.id, p_note: 'تأكيد من لوحة الإدارة', p_provider: $('#pp', sh).value, p_ref: $('#pr', sh).value.trim() || null }), 'تم التفعيل')),
  'sub-cancel': async el => { if (await confirmBox('إلغاء الاشتراك المعلّق؟', { danger: true })) act(el, () => patch('subscriptions', +el.dataset.id, { status: 'cancelled' }), 'تم الإلغاء'); },
  'plan-new': () => ACT['plan-edit']({ dataset: {} }),
  'plan-edit': el => { const p = A.cache.plans.find(x => x.id === el.dataset.id) || {}; promptSheet(p.id ? 'تعديل الباقة' : 'باقة جديدة', `${p.id ? '' : '<div class="field"><label>المعرّف (إنجليزي)</label><input class="inp ltr" id="pi" placeholder="quarterly"></div>'}<div class="field"><label>الاسم</label><input class="inp" id="pn" value="${esc(p.name_ar || '')}"></div><div class="grid2"><div class="field"><label>عدد الأشهر</label><input class="inp" id="pm" type="number" min="1" max="36" value="${p.months || 1}"></div><div class="field"><label>السعر (د.ك)</label><input class="inp" id="pv" type="number" step="0.001" value="${p.price_kwd ?? ''}"></div></div><button type="button" class="switch" id="pa"><span><b>فعّالة</b></span><span class="tgl ${p.is_active !== false ? 'on' : ''}"></span></button>`,
    (sh, b) => { act(b, async () => { const body = { name_ar: $('#pn', sh).value.trim(), months: +$('#pm', sh).value, price_kwd: +$('#pv', sh).value, is_active: $('#pa .tgl', sh).classList.contains('on') }; if (p.id) await patch('subscription_plans', p.id, body); else { const id = $('#pi', sh).value.trim().toLowerCase(); if (!/^[a-z][a-z0-9_]{1,30}$/.test(id)) throw new Error('المعرّف غير صالح'); await rest('subscription_plans', { method: 'POST', body: Object.assign({ id }, body), prefer: 'return=minimal' }); } }, 'تم الحفظ'); }); },
  'adprice-save': el => act(el, async () => {
    const v = {};
    $$('#ptbl input').forEach(i => { if (i.value === '') return; const n = Number(i.value); if (!(n >= 0)) throw new Error('سعر غير صالح'); (v[i.dataset.t] = v[i.dataset.t] || {})[i.dataset.d] = n; });
    const r = await rest('app_settings?key=eq.ad_prices', { method: 'PATCH', body: { value: v }, prefer: 'return=representation' });
    if (!r || !r.length) await rest('app_settings', { method: 'POST', body: { key: 'ad_prices', value: v, is_public: true }, prefer: 'return=minimal' });
  }, 'تم حفظ الأسعار'),
  'svc-new': () => svcSheet(),
  'svc-edit': el => svcSheet(A.services.find(s => s.id === el.dataset.id)),
  'area-new': () => promptSheet('منطقة جديدة', '<div class="field"><label>اسم المنطقة</label><input class="inp" id="an" maxlength="40"></div>', (sh, b) => act(b, () => { const n = $('#an', sh).value.trim(); if (n.length < 2) throw new Error('اكتب الاسم'); return rest('areas', { method: 'POST', body: { name_ar: n }, prefer: 'return=minimal' }); }, 'تمت الإضافة')),
  'area-edit': el => { const a = A.areas.find(x => x.id === +el.dataset.id); promptSheet('تعديل المنطقة', `<div class="field"><label>الاسم</label><input class="inp" id="an" maxlength="40" value="${esc(a.name_ar)}"></div>`, (sh, b) => act(b, () => patch('areas', a.id, { name_ar: $('#an', sh).value.trim() }), 'تم الحفظ')); },
  'bn-new': () => bnSheet(),
  'bn-edit': el => bnSheet(A.cache.banners.find(b => b.id === +el.dataset.id)),
  'bn-toggle': el => act(el, () => { const b = A.cache.banners.find(x => x.id === +el.dataset.id); return patch('banners', b.id, { is_active: !b.is_active }); }, 'تم التحديث'),
  'bn-del': async el => { if (await confirmBox('حذف البانر؟', { ok: 'حذف', danger: true })) act(el, () => rest('banners?id=eq.' + (+el.dataset.id), { method: 'DELETE' }), 'تم الحذف'); },
  'settings-save': el => act(el, async () => {
    const wa = digits($('#swa').value); if (wa && wa.length < 8) throw new Error('invalid phone');
    const mm = $('#smm').value.trim();
    await rest('app_settings?key=eq.support_whatsapp', { method: 'PATCH', body: { value: wa ? intlPhone(wa) : null }, prefer: 'return=minimal' });
    await rest('app_settings?key=eq.maintenance_message', { method: 'PATCH', body: { value: mm || null }, prefer: 'return=minimal' });
  }, 'تم حفظ الإعدادات'),
};
document.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (!a) return; const f = ACT[a.dataset.act]; if (f) { if (a.tagName === 'A') e.preventDefault(); f(a, e); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
boot();
