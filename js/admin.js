// ماتعطل — لوحة الإدارة. كل صلاحية هنا محمية في الخادم (RLS + is_admin)، والواجهة مجرد عرض.
import {
  esc, $, $$, todayISO, addDays, digits, localPhone, intlPhone, rnd, safeImg, fmtDate, norm, errText,
  initSession, session, login, logout, myProfile, rpc, rest, shrinkImage, upload, icon, svcIcon, toast, sheet, closeSheet, confirmBox, busy,
} from './core.js';

initSession('session'); // جلسة الإدارة تنتهي بإغلاق المتصفح
const A = { me: null, tab: 'join', services: [], areas: [], cache: {} };
// لوحة مبسّطة: الطلبات (قبول/رفض) + مقدمو الخدمات فقط
const TABS = [['join', 'الطلبات', 'users'], ['companies', 'مقدمو الخدمات', 'store']];
const svcName = id => (A.services.find(s => s.id === id) || {}).name_ar || id || '—';
const root = () => $('#adm');
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
    A.tab = (location.hash.replace('#', '') || 'join'); if (!TABS.some(t => t[0] === A.tab)) A.tab = 'join';
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
    const [pc, jr] = await Promise.all([rest('companies?select=id&status=eq.pending'), rest('join_requests?select=id&status=eq.new')]);
    const set = (k, n) => $$(`[data-cnt="${k}"]`).forEach(x => { x.hidden = !n; x.textContent = n; });
    set('join', (pc || []).length + (jr || []).length);
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

/* ---------------- الطلبات ---------------- */
const CO_SEL = 'id,name,service_id,phone,whatsapp,price_text,description,logo_url,cover_url,status,is_active,sub_start,sub_end,is_24h,owner_id,created_at,address,company_areas(area_id)';
const areaNames = c => (c.company_areas || []).map(x => (A.areas.find(a => a.id === x.area_id) || {}).name_ar).filter(Boolean).join('، ');
const waBtn = ph => ph ? `<a class="btn xs wa" target="_blank" rel="noopener" href="https://wa.me/${intlPhone(ph)}">${icon('wa')}تواصل</a>` : '';
const logo = (url, svc) => safeImg(url) ? `<img src="${esc(safeImg(url))}" alt="">` : `<span class="ph">${svcIcon(svc)}</span>`;

async function vJoin(m) {
  const [pend, legacy] = await Promise.all([rest(`companies?select=${CO_SEL}&status=eq.pending&order=created_at.desc`), rest('join_requests?select=*&status=eq.new&order=created_at.desc')]);
  A.cache.cos = pend || []; A.cache.jr = legacy || [];
  const rows = [
    ...(pend || []).map(c => `<div class="arow"><div class="top">${logo(c.logo_url, c.service_id)}
      <div class="t"><b>${esc(c.name)}</b><small>${esc(svcName(c.service_id))} · <span dir="ltr">${esc(c.phone || '')}</span> · ${fmtDate(c.created_at)}</small></div></div>
      ${areaNames(c) || c.description ? `<div class="kvs">${areaNames(c) ? `<span><b>المناطق:</b> ${esc(areaNames(c))}</span>` : ''}${c.description ? `<span>${esc(c.description)}</span>` : ''}</div>` : ''}
      <div class="btns"><button class="btn sm primary" data-act="co-approve" data-id="${c.id}">${icon('check')}قبول</button><button class="btn sm danger-soft" data-act="co-reject" data-id="${c.id}">رفض</button>${waBtn(c.whatsapp || c.phone)}</div></div>`),
    ...(legacy || []).map(r => `<div class="arow"><div class="top">${logo(r.logo_url, r.service_id)}
      <div class="t"><b>${esc(r.company_name)}</b><small>${esc(svcName(r.service_id))}${r.area_name ? ' · ' + esc(r.area_name) : ''} · <span dir="ltr">${esc(r.phone)}</span> · ${fmtDate(r.created_at)}</small></div></div>
      <div class="btns"><button class="btn sm primary" data-act="jr-accept" data-id="${r.id}">${icon('check')}قبول</button><button class="btn sm danger-soft" data-act="jr-reject" data-id="${r.id}">رفض</button>${waBtn(r.phone)}</div></div>`),
  ];
  m.innerHTML = head(`الطلبات (${rows.length})`) + `<p style="color:var(--mut);font-size:13px;margin:-6px 0 12px">القبول ينشر مقدم الخدمة مباشرة لمدة 30 يوم.</p>
    <div class="rows">${rows.join('') || `<div class="empty"><div class="big">${icon('check')}</div><b>لا توجد طلبات جديدة</b></div>`}</div>`;
}

/* ---------------- مقدمو الخدمات ---------------- */
const tgStatus = c => {
  if (c.status === 'pending') return '<span class="tg warn">بانتظار الموافقة</span>';
  if (c.status === 'rejected') return '<span class="tg bad">مرفوض</span>';
  if (c.status === 'suspended' || !c.is_active) return '<span class="tg bad">موقوف</span>';
  if (c.sub_end < todayISO()) return '<span class="tg warn">منتهي</span>';
  return '<span class="tg ok">ظاهر</span>';
};
async function vCompanies(m) {
  const list = (await rest(`companies?select=${CO_SEL}&status=neq.rejected&order=created_at.desc`) || []).filter(c => c.status !== 'pending');
  A.cache.cos = list;
  const q = A.cache.coQ || '';
  const filt = list.filter(c => !q || norm(c.name + ' ' + c.phone + ' ' + svcName(c.service_id)).includes(norm(q)));
  m.innerHTML = head(`مقدمو الخدمات (${list.length})`, `<button class="btn sm primary" data-act="co-new">${icon('plus')}إضافة</button>`) +
    `<div class="toolbar"><input class="inp" id="coq" placeholder="بحث بالاسم أو الرقم" value="${esc(q)}"></div>
    <div class="rows">${filt.map(c => `<div class="arow"><div class="top">${logo(c.logo_url, c.service_id)}
      <div class="t"><b>${esc(c.name)}</b><small>${esc(svcName(c.service_id))} · <span dir="ltr">${esc(c.phone || '')}</span> · ينتهي ${fmtDate(c.sub_end)}</small></div>${tgStatus(c)}</div>
      <div class="btns">
        <button class="btn xs ghost" data-act="co-extend" data-id="${c.id}">+30 يوم</button>
        <button class="btn xs ghost" data-act="co-toggle" data-id="${c.id}">${c.is_active ? icon('pause') + 'إيقاف' : icon('play') + 'تفعيل'}</button>
        <button class="btn xs ghost" data-act="co-edit" data-id="${c.id}">${icon('edit')}تعديل</button>
        <button class="btn xs danger-soft" data-act="co-del" data-id="${c.id}">${icon('trash')}</button></div></div>`).join('') || '<div class="empty"><b>لا توجد نتائج</b></div>'}</div>`;
  const i = $('#coq'); i.oninput = () => { clearTimeout(i._t); i._t = setTimeout(() => { A.cache.coQ = i.value; vCompanies(m).then(() => { const n = $('#coq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); }, 300); };
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

const VIEWS = { join: vJoin, companies: vCompanies };

/* ---------------- الإجراءات ---------------- */
const promptSheet = (title, fields, onSave) => sheet(`<div class="sheet-h"><h3>${esc(title)}</h3><button class="icon-btn clear" data-close>${icon('close')}</button></div><div class="sheet-body">${fields}<button class="btn primary block" id="psave">حفظ</button></div>`, { onOpen: sh => { $$('.switch', sh).forEach(w => w.onclick = () => $('.tgl', w).classList.toggle('on')); $('#psave', sh).onclick = e => onSave(sh, e.currentTarget); } });
const ACT = {
  reload: () => show(),
  logout: async (el, e) => { e.preventDefault(); await logout(); loginView(); },
  'co-new': () => { const sh = sheet(coForm()); bindCoForm(sh); },
  'co-edit': el => { const c = coById(el.dataset.id); const sh = sheet(coForm(c)); bindCoForm(sh, c); },
  'co-approve': el => act(el, () => { const c = coById(el.dataset.id); return patch('companies', c.id, { status: 'approved', is_active: true, sub_start: todayISO(), sub_end: c.sub_end && c.sub_end >= todayISO() ? c.sub_end : addDays(todayISO(), 30) }); }, 'تمت الموافقة والنشر'),
  'co-reject': async el => { if (await confirmBox('رفض طلب الانضمام؟', { ok: 'رفض', danger: true })) act(el, () => patch('companies', +el.dataset.id, { status: 'rejected', is_active: false }), 'تم الرفض'); },
  'co-toggle': el => act(el, () => { const c = coById(el.dataset.id); return patch('companies', c.id, { is_active: !c.is_active }); }, 'تم التحديث'),
  'co-extend': el => act(el, () => { const c = coById(el.dataset.id); const b = c.sub_end < todayISO() ? todayISO() : c.sub_end; return patch('companies', c.id, { sub_end: addDays(b, 30), is_active: true }); }, 'تم التمديد 30 يوم'),
  'co-del': async el => { const c = coById(el.dataset.id); if (!(await confirmBox(`حذف «${c.name}» نهائياً؟ يُفضّل «إيقاف» بدلاً من الحذف للحفاظ على البيانات.`, { ok: 'حذف نهائي', danger: true }))) return; act(el, async () => { await rest('company_areas?company_id=eq.' + c.id, { method: 'DELETE' }); const r = await rest('companies?id=eq.' + c.id, { method: 'DELETE', prefer: 'return=representation' }); if (!r || !r.length) throw new Error('forbidden'); }, 'تم الحذف'); },
  'jr-accept': el => act(el, async () => {
    const q = A.cache.jr.find(x => x.id === +el.dataset.id); const ph = localPhone(q.phone) || digits(q.phone);
    const r = await rest('companies', { method: 'POST', prefer: 'return=representation', body: { service_id: q.service_id, name: q.company_name, phone: ph, whatsapp: ph, is_active: true, status: 'approved', is_sample: false, sub_start: todayISO(), sub_end: addDays(todayISO(), 30), logo_url: q.logo_url || null } });
    const ar = A.areas.find(a => a.name_ar === q.area_name); if (ar) await rest('company_areas', { method: 'POST', body: { company_id: r[0].id, area_id: ar.id }, prefer: 'return=minimal' });
    await patch('join_requests', q.id, { status: 'accepted' });
  }, 'تمت الإضافة باشتراك 30 يوم'),
  'jr-reject': async el => { if (await confirmBox('رفض الطلب؟', { ok: 'رفض', danger: true })) act(el, () => patch('join_requests', +el.dataset.id, { status: 'rejected' }), 'تم الرفض'); },
};
document.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (!a) return; const f = ACT[a.dataset.act]; if (f) { if (a.tagName === 'A') e.preventDefault(); f(a, e); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
boot();
