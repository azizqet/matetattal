// ماتعطل — تطبيق العملاء (SPA بتوجيه عبر الـ hash ليعمل على GitHub Pages)
import {
  CFG, esc, $, $$, todayISO, digits, localPhone, intlPhone, rnd, safeImg, fmtDate, fmtNum, norm, store, errText,
  initSession, session, onAuth, login, register, logout, myProfile, api, rpc, rest, shrinkImage, upload,
  icon, svcIcon, toast, sheet, closeSheet, confirmBox, busy, cropImage, loadLeaflet, tileLayer, markerIcon, pickOnMap, geo, distKm, nearestArea,
} from './core.js';

initSession('local');
const VERSION = '4.5.0';
const COLS = 'id,service_id,name,phone,whatsapp,price_text,rating,rating_count,logo_url,cover_url,photos,description,address,lat,lng,is_24h,is_available,created_at,featured_until,is_sample,company_areas(areas(name_ar)),company_services(service_id)';

/* ================= الحالة ================= */
const S = {
  services: [], areas: [], cos: [], banners: [], ads: [], settings: {},
  loaded: false, err: null, profile: null, isAdmin: false,
  area: store.get('area', 'all'), pos: store.get('pos', null),
  favs: new Set(store.get('favs', [])), recent: store.get('recent', []),
  installEvt: null,
};
const svc = id => S.services.find(s => s.id === id);
const svcName = id => (svc(id) || {}).name_ar || '';
const coById = id => S.cos.find(c => c.id === +id);
const supportWa = () => digits(S.settings.support_whatsapp) || CFG.supportWa;

function mapCo(r) {
  const svcs = new Set([r.service_id, ...((r.company_services || []).map(x => x.service_id))].filter(Boolean));
  return {
    id: r.id, s: r.service_id, svcs, name: r.name || '', phone: localPhone(r.phone) || digits(r.phone), wa: localPhone(r.whatsapp) || localPhone(r.phone) || digits(r.whatsapp || r.phone),
    price: r.price_text || '', rating: Number(r.rating) || 0, rc: r.rating_count || 0, logo: safeImg(r.logo_url), cover: safeImg(r.cover_url),
    photos: (r.photos || []).map(safeImg).filter(Boolean), desc: r.description || '', addr: r.address || '',
    lat: r.lat, lng: r.lng, h24: !!r.is_24h, avail: r.is_available !== false, created: r.created_at,
    feat: !!(r.featured_until && r.featured_until >= todayISO()),
    areas: (r.company_areas || []).map(x => x.areas && x.areas.name_ar).filter(Boolean),
  };
}
function applyPublic(d) {
  S.services = (d.services || []).filter(s => s.is_active !== false).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  S.areas = (d.areas || []).map(a => a.name_ar);
  S.cos = (d.cos || []).filter(c => !c.is_sample).map(mapCo);
  S.banners = d.banners || []; S.ads = d.ads || []; S.plans = d.plans || [];
  S.settings = {}; (d.settings || []).forEach(x => { S.settings[x.key] = x.value; });
  const featIds = new Set(S.ads.filter(a => a.ad_type === 'featured' && a.company_id).map(a => a.company_id));
  S.cos.forEach(c => { if (featIds.has(c.id)) c.feat = true; });
  S.loaded = true;
}
async function loadPublic(force) {
  const cached = store.get('pub');
  if (cached && !S.loaded) { applyPublic(cached.d); render(); }
  if (!force && cached && Date.now() - cached.t < 60000 && S.loaded) return;
  try {
    const t = todayISO();
    const [services, areas, cos, banners, ads, settings, plans] = await Promise.all([
      rest('services?select=id,name_ar,sort,icon,is_active&order=sort.asc', { anon: true }),
      rest('areas?select=id,name_ar&order=id.asc', { anon: true }),
      rest(`companies?select=${COLS}&is_active=eq.true&status=eq.approved&sub_end=gte.${t}&order=created_at.desc&limit=1000`, { anon: true }),
      rest('banners?select=id,title,subtitle,image_url,company_id,sort&is_active=eq.true&order=sort.asc', { anon: true }).catch(() => []),
      rpc('live_ads', {}, { anon: true }).catch(() => []),
      rest('app_settings?select=key,value&is_public=eq.true', { anon: true }).catch(() => []),
      rest('subscription_plans?select=id,name_ar,months,price_kwd,sort&is_active=eq.true&order=sort.asc', { anon: true }).catch(() => []),
    ]);
    const d = { services, areas, cos, banners, ads, settings, plans };
    applyPublic(d); S.err = null; store.set('pub', { t: Date.now(), d });
  } catch (e) { S.err = e; if (!S.loaded) S.loaded = false; }
  render(true);
}
async function loadMe() {
  if (!session()) { S.profile = null; S.isAdmin = false; return; }
  try {
    S.profile = await myProfile();
    S.isAdmin = !!(S.profile && S.profile.role === 'admin');
    await syncFavs();
  } catch (e) { if (/JWT|session|401/.test(String(e.message))) await logout(); }
}
onAuth(() => { loadMe().then(() => render(true)); });

/* ================= المفضلة ================= */
async function syncFavs() {
  if (!session()) return;
  try {
    const local = [...S.favs];
    const r = await rest('favorites?select=company_id');
    const server = new Set((r || []).map(x => x.company_id));
    const add = local.filter(id => !server.has(id));
    if (add.length) await rest('favorites', { method: 'POST', body: add.map(id => ({ company_id: id })), prefer: 'resolution=ignore-duplicates,return=minimal' }).catch(() => { });
    S.favs = new Set([...server, ...add]); store.set('favs', [...S.favs]);
  } catch (_) { }
}
async function toggleFav(id, btn) {
  id = +id; const on = !S.favs.has(id);
  on ? S.favs.add(id) : S.favs.delete(id); store.set('favs', [...S.favs]);
  $$(`[data-act="fav"][data-id="${id}"]`).forEach(b => b.classList.toggle('on', on));
  toast(on ? 'تمت الإضافة للمفضلة' : 'تمت الإزالة من المفضلة');
  if (session()) {
    try {
      if (on) await rest('favorites', { method: 'POST', body: { company_id: id }, prefer: 'resolution=ignore-duplicates,return=minimal' });
      else await rest('favorites?company_id=eq.' + id, { method: 'DELETE' });
    } catch (_) { }
  }
}

/* ================= التتبع ================= */
const tracked = new Set();
function track(kind, company) {
  const k = kind + ':' + (company || '');
  if (kind !== 'search' && tracked.has(k)) return; tracked.add(k);
  rpc('track_event', { p_kind: kind, p_company: company ? +company : null }, { anon: true }).catch(() => { });
}
const adSeen = new Set();
const trackAd = (id, kind) => { const k = id + kind; if (adSeen.has(k)) return; adSeen.add(k); rpc('track_ad', { p_id: +id, p_kind: kind }, { anon: true }).catch(() => { }); };

/* ================= أجزاء واجهة ================= */
const waText = c => {
  let t = 'السلام عليكم، وصلت لكم عن طريق تطبيق ماتعطل وأحتاج خدمة' + (c && c.s ? ' (' + svcName(c.s) + ')' : '') + '.';
  if (S.pos) t += '\nموقعي: https://maps.google.com/?q=' + S.pos.lat.toFixed(6) + ',' + S.pos.lng.toFixed(6);
  return t;
};
const telHref = p => 'tel:+' + intlPhone(p);
const waHref = (p, text) => 'https://wa.me/' + intlPhone(p) + (text ? '?text=' + encodeURIComponent(text) : '');
function media(c, big) {
  if (c.cover) return `<img src="${esc(c.cover)}" alt="" loading="lazy" decoding="async">`;
  if (c.logo) return `<img class="fit" src="${esc(c.logo)}" alt="" loading="lazy" decoding="async">`;
  return `<div class="ph-media">${svcIcon(svc(c.s) || c.s)}${big ? '' : `<span class="mono">ماتعطل</span>`}</div>`;
}
const areaText = c => c.areas.length ? (c.areas[0] + (c.areas.length > 1 ? ` +${c.areas.length - 1}` : '')) : 'الكويت';
const rateHtml = c => c.rc > 0 ? `<span class="rate">${icon('star')}${c.rating.toFixed(1)} <small style="color:var(--mut);font-weight:700">(${c.rc})</small></span>` : '<span class="new-tag">جديد</span>';
const distOf = c => (S.pos && c.lat != null && c.lng != null) ? distKm(S.pos, { lat: c.lat, lng: c.lng }) : null;
const distTxt = c => { const d = distOf(c); return d == null ? '' : (d < 1 ? Math.round(d * 1000) + ' م' : d.toFixed(1) + ' كم'); };
function actions(c) {
  return `<div class="acts">
    <a class="btn dark" href="${telHref(c.phone || c.wa)}" data-track="call" data-id="${c.id}">${icon('phone')}اتصال</a>
    <a class="btn wa" href="${waHref(c.wa || c.phone, waText(c))}" target="_blank" rel="noopener" data-track="whatsapp" data-id="${c.id}">${icon('wa')}واتساب</a></div>`;
}
function pcard(c) {
  const fav = S.favs.has(c.id);
  return `<div class="pcard" data-href="#/c/${c.id}" role="link" tabindex="0" aria-label="${esc(c.name)}">
    <div class="media blue">${c.cover ? `<img src="${esc(c.cover)}" alt="" loading="lazy" decoding="async">` : `<span class="bigic">${svcIcon(svc(c.s) || c.s)}</span>`}
      <div class="badges">${distTxt(c) ? `<span class="badge glass">${icon('pin')}${distTxt(c)}</span>` : ''}${c.feat ? `<span class="badge y">${icon('star')}مميز</span>` : ''}${c.h24 ? `<span class="badge glass">${icon('clock')}24 ساعة</span>` : ''}</div>
      <button class="fav-mini ${fav ? 'on' : ''}" data-act="fav" data-id="${c.id}" aria-label="المفضلة">${icon('heart')}</button>
      <span class="av">${c.logo ? `<img src="${esc(c.logo)}" alt="" loading="lazy">` : svcIcon(svc(c.s) || c.s)}</span></div>
    <div class="body"><div class="nm">${esc(c.name)}</div>
      <div class="meta">${svcIcon(svc(c.s) || c.s)}<span>${esc(svcName(c.s))}</span></div>
      <div class="meta">${icon('pin')}<span>${esc(areaText(c))}${distTxt(c) ? ' · ' + distTxt(c) : ''}</span><span style="margin-inline-start:auto">${rateHtml(c)}</span></div>
      ${actions(c)}</div></div>`;
}
function lcard(c) {
  return `<div class="lcard" data-href="#/c/${c.id}" role="link" tabindex="0" aria-label="${esc(c.name)}">
    <div class="thumb">${media(c)}</div>
    <div class="info"><div class="nm">${esc(c.name)}</div>
      <div class="meta">${icon('pin')}<span>${esc(areaText(c))}${distTxt(c) ? ' · ' + distTxt(c) : ''}</span></div>
      <div class="tagline"><span class="tg">${esc(svcName(c.s))}</span>${c.feat ? '<span class="tg y">مميز</span>' : ''}${c.h24 ? '<span class="tg">24 ساعة</span>' : ''}${rateHtml(c)}</div>
      ${actions(c)}</div></div>`;
}
const skRail = () => `<div class="rail">${'<div class="sk sk-card"></div>'.repeat(3)}</div>`;
const emptyBox = (ic, t, p, extra = '') => `<div class="empty"><div class="big">${icon(ic)}</div><b>${esc(t)}</b>${p ? `<p>${esc(p)}</p>` : ''}${extra}</div>`;
const topbar = (title, { back = true, right = '' } = {}) => `<header class="topbar line">${back ? `<button class="icon-btn clear" data-act="back" aria-label="رجوع">${icon('chevR')}</button>` : ''}<h1>${esc(title)}</h1>${right}</header>`;
const errBox = () => `<div class="pad" style="margin-top:14px">${emptyBox('refresh', 'تعذّر تحميل البيانات', errText(S.err), `<button class="btn primary" data-act="reload">${icon('refresh')}إعادة المحاولة</button>`)}</div>`;

function adLink(a) {
  if (a.link_type === 'call' && a.phone) return { href: telHref(a.phone) };
  if (a.link_type === 'whatsapp' && a.phone) return { href: waHref(a.phone, 'السلام عليكم، شفت إعلانكم في ماتعطل'), ext: true };
  if (a.link_type === 'company' && a.company_id) return { href: '#/c/' + a.company_id };
  return null;
}
function bannerHtml(b, kind) {
  if (kind === 'ad') {
    const l = adLink(b), tag = l ? 'a' : 'div';
    return `<${tag} class="banner" ${l ? `href="${esc(l.href)}" ${l.ext ? 'target="_blank" rel="noopener"' : ''}` : ''} data-ad="${b.id}">
      <img src="${esc(safeImg(b.image_url))}" alt="${esc(b.title || 'إعلان')}" loading="lazy"><span class="adtag">إعلان</span>
      ${b.title ? `<div class="cap"><b>${esc(b.title)}</b><span>${esc(b.advertiser_name || '')}</span></div>` : ''}</${tag}>`;
  }
  const tag = b.company_id ? 'a' : 'div';
  return `<${tag} class="banner" ${b.company_id ? `href="#/c/${+b.company_id}"` : ''}>${safeImg(b.image_url) ? `<img src="${esc(safeImg(b.image_url))}" alt="" loading="lazy">` : ''}
    ${(b.title || b.subtitle) ? `<div class="cap"><b>${esc(b.title || '')}</b><span>${esc(b.subtitle || '')}</span></div>` : ''}</${tag}>`;
}
function promos() {
  return [
    `<a class="banner promo" href="#/categories"><span class="k">ماتعطل · الكويت</span><b>كل خدمات سيارتك في مكان واحد</b><span class="go">تصفّح الأقسام${icon('chevL')}</span><span class="art">${icon('tow')}</span></a>`,
    `<a class="banner promo y" href="#/advertise"><span class="k">مساحة إعلانية</span><b>إعلانك هنا يوصل لأصحاب السيارات</b><span class="go">أعلن معنا${icon('chevL')}</span><span class="art">${icon('megaphone')}</span></a>`,
    `<a class="banner promo" href="#/join"><span class="k">لمقدمي الخدمات</span><b>تقدم خدمة سيارات؟ انضم لماتعطل</b><span class="go">انضم الآن${icon('chevL')}</span><span class="art">${icon('store')}</span></a>`,
  ];
}
function carousel(items) {
  return `<div class="carousel" data-carousel>${items.join('')}</div><div class="dots">${items.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>`;
}

/* ================= الصفحات ================= */
function areaLabel() { return S.area === 'all' ? 'كل الكويت' : S.area; }
function nearbyList() {
  let list = S.cos.slice();
  if (S.pos) {
    const withD = list.filter(c => distOf(c) != null).sort((a, b) => distOf(a) - distOf(b));
    const inA = list.filter(c => distOf(c) == null && S.area !== 'all' && c.areas.includes(S.area));
    return [...withD.filter(c => distOf(c) <= 40), ...inA].slice(0, 12);
  }
  if (S.area === 'all') return [];
  return list.filter(c => c.areas.includes(S.area)).slice(0, 12);
}

function pgHome() {
  const maint = S.settings.maintenance_message;
  const homeAds = S.ads.filter(a => a.ad_type === 'home_banner' && safeImg(a.image_url));
  const items = [...homeAds.map(a => bannerHtml(a, 'ad')), ...S.banners.map(b => bannerHtml(b)), ...promos()];
  const cats = S.services.map(s => `<a class="cat" href="#/s/${esc(s.id)}"><span class="ic tile t-${esc(s.icon || s.id)}">${svcIcon(s)}</span><span class="n">${esc(s.name_ar)}</span></a>`).join('');
  let nearby, featured = '', latest;
  if (!S.loaded) { nearby = skRail(); latest = skRail(); }
  else {
    const nb = nearbyList();
    if (S.area === 'all' && !S.pos) nearby = `<div class="pad"><div class="note y">${icon('pin')}<div><b>حدد موقعك</b> لعرض مقدمي الخدمة القريبين منك.<div class="row2" style="margin-top:10px"><button class="btn sm dark" data-act="locate">${icon('locate')}موقعي الحالي</button><button class="btn sm ghost" data-act="area">اختيار المنطقة</button></div></div></div></div>`;
    else nearby = nb.length ? `<div class="rail">${nb.map(pcard).join('')}</div>` : `<div class="pad"><div class="note">${icon('info')}<div>ما فيه مقدمي خدمة مسجّلين في ${esc(areaLabel())} حالياً. <a href="#/categories" style="font-weight:800;text-decoration:underline">تصفّح كل الكويت</a></div></div></div>`;
    const fe = S.cos.filter(c => c.feat);
    if (fe.length) featured = `<section class="sec"><div class="sec-h"><h2>المميز</h2></div><div class="rail">${fe.map(pcard).join('')}</div></section>`;
    const lt = S.cos.slice().sort((a, b) => String(b.created).localeCompare(String(a.created))).slice(0, 10);
    latest = lt.length ? `<div class="rail">${lt.map(pcard).join('')}</div>` : `<div class="pad">${emptyBox('store', 'لا يوجد مقدمو خدمة بعد', 'كن أول مقدم خدمة على ماتعطل.', '<a class="btn primary" href="#/join">انضم الآن</a>')}</div>`;
  }
  return {
    tab: 'home',
    html: `
    <div class="home-band"><div class="home-head"><div class="logo wordmark" aria-label="ماتعطل">ماتعطل<span class="dot"></span></div>
      <button class="loc-chip" data-act="area" aria-label="اختيار المنطقة">${icon('pin', 'pin')}<span>${esc(areaLabel())}</span>${icon('chevD')}</button></div>
      <div class="greet"><small>${new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير'} 👋</small><h1>وين ما تعطلت...<br>إحنا قريبين منك.</h1></div></div>
    <div class="search-float"><a class="sbtn" href="#/search" aria-label="بحث">${icon('search')}</a><a class="sph" href="#/search">ابحث عن سطحة، بنشر، مفاتيح...</a><a class="sflt" href="#/categories" aria-label="الفلاتر">${icon('filter')}</a></div>
    <a class="sos" href="#/s/tow"><span class="ic">${icon('siren')}</span><span class="t"><b>سيارتك تعطلت؟</b><small>اطلب سطحة الآن وتواصل مباشرة</small></span>${icon('arrowL', 'go')}</a>
    ${installCard()}
    ${maint ? `<div class="pad" style="margin-top:12px"><div class="note y">${icon('info')}<div>${esc(maint)}</div></div></div>` : ''}
    ${S.err && !S.loaded ? errBox() : ''}
    ${homeAds.length || S.banners.length ? `<section class="sec">${carousel(items.slice(0, homeAds.length + S.banners.length))}</section>` : ''}
    <section class="sec"><div class="sec-h"><h2>الخدمات</h2><a class="more" href="#/categories">الكل${icon('chevL')}</a></div><div class="cats">${cats || '<div class="sk" style="grid-column:1/-1;height:180px"></div>'}</div></section>
    <section class="sec"><div class="sec-h"><h2>قريب منك</h2>${S.area !== 'all' || S.pos ? `<a class="more" href="#/s/${esc((S.services[0] || {}).id || 'tow')}?sort=near">عرض الكل${icon('chevL')}</a>` : ''}</div>${nearby}</section>
    ${featured}
    ${!homeAds.length && !S.banners.length ? `<section class="sec">${carousel(promos())}</section>` : ''}
    <section class="sec"><div class="sec-h"><h2>أحدث مقدمي الخدمات</h2></div>${latest}</section>
    <div class="footer-note">ماتعطل · منصة خدمات السيارات في الكويت<br>التواصل والدفع يتم مباشرة بينك وبين مقدم الخدمة.</div>`,
    after: el => { initCarousel(el); },
  };
}
function installCard() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone || store.get('installDismiss')) return '';
  return `<div class="install-card"><img class="app-ic" src="icons/icon-192.png" alt="أيقونة ماتعطل" width="52" height="52"><div style="flex:1"><b>حمّل تطبيق ماتعطل</b><small>أيقونة على شاشتك الرئيسية — يفتح مثل التطبيق</small></div><button class="btn sm primary" data-act="install">${icon('download')}تحميل</button><button class="icon-btn clear" data-act="install-hide" aria-label="إخفاء" style="width:32px;height:32px">${icon('close')}</button></div>`;
}
function initCarousel(root) {
  const c = $('[data-carousel]', root); if (!c) return;
  const dots = $$('.dots i', root); let idx = 0, timer = null, userT = 0;
  const upd = () => { const w = c.clientWidth + 10; idx = Math.round(Math.abs(c.scrollLeft) / w); dots.forEach((d, i) => d.classList.toggle('on', i === idx)); };
  c.addEventListener('scroll', () => { cancelAnimationFrame(c._r); c._r = requestAnimationFrame(upd); }, { passive: true });
  c.addEventListener('touchstart', () => { userT = Date.now(); }, { passive: true });
  const n = c.children.length;
  if (n > 1) timer = setInterval(() => {
    if (!c.isConnected) return clearInterval(timer);
    if (Date.now() - userT < 6000 || document.hidden) return;
    const next = (idx + 1) % n; const w = c.clientWidth + 10;
    c.scrollTo({ left: (getComputedStyle(c).direction === 'rtl' ? -1 : 1) * next * w, behavior: 'smooth' });
  }, 5200);
  // مشاهدات الإعلانات الفعلية (عند ظهور 60% من الإعلان)
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { trackAd(e.target.dataset.ad, 'view'); io.unobserve(e.target); } }), { threshold: .6 });
  $$('[data-ad]', root).forEach(x => io.observe(x));
}

function pgCategories() {
  const n = id => S.cos.filter(c => c.svcs.has(id)).length;
  return {
    tab: 'cats',
    html: `<header class="topbar"><h1 style="font-size:24px">الأقسام</h1></header>
    <a class="searchbar" href="#/search" style="margin-bottom:14px">${icon('search')}<span class="ph">ابحث في كل الأقسام</span></a>
    <div class="cat-list">${S.services.map(s => `<a class="cat-row" href="#/s/${esc(s.id)}"><span class="ic tile t-${esc(s.icon || s.id)}">${svcIcon(s)}</span><span><b>${esc(s.name_ar)}</b><small>${S.loaded ? (n(s.id) ? fmtNum(n(s.id)) + ' مقدم خدمة' : 'لا يوجد حالياً') : '...'}</small></span>${icon('chevL', 'chev')}</a>`).join('') || '<div class="sk" style="height:300px"></div>'}</div>
    ${S.err && !S.loaded ? errBox() : ''}`,
  };
}

function filterSort(list, q) {
  const area = q.get('area') || S.area, sort = q.get('sort') || (S.pos ? 'near' : 'new'), h24 = q.get('h24') === '1', text = norm(q.get('q') || '');
  let r = list.slice();
  if (h24) r = r.filter(c => c.h24);
  if (text) r = r.filter(c => norm([c.name, c.desc, c.price, svcName(c.s), c.areas.join(' ')].join(' ')).includes(text));
  const byNew = (a, b) => String(b.created).localeCompare(String(a.created));
  if (sort === 'near') r.sort((a, b) => { const da = distOf(a), db = distOf(b); if (da == null && db == null) return (b.feat - a.feat) || byNew(a, b); if (da == null) return 1; if (db == null) return -1; return da - db; });
  else if (sort === 'rating') r.sort((a, b) => (b.rc > 0) - (a.rc > 0) || b.rating - a.rating || b.rc - a.rc);
  else r.sort((a, b) => (b.feat - a.feat) || byNew(a, b));
  // مقدمو المنطقة أولاً، ثم «مناطق أخرى» حتى لا يختفي أحد
  let other = [];
  if (area !== 'all') { const inA = c => c.areas.includes(area) || c.areas.length === 0; other = r.filter(c => !inA(c)); r = r.filter(inA); }
  return { r, other, area, sort, h24 };
}
const SORTS = { new: 'الأحدث', near: 'الأقرب', rating: 'الأعلى تقييماً' };
function pgService([id], q) {
  const s = svc(id);
  if (S.loaded && !s) return { html: topbar('القسم') + emptyBox('grid', 'القسم غير موجود', '', '<a class="btn primary" href="#/categories">كل الأقسام</a>') };
  const all = S.cos.filter(c => c.svcs.has(id));
  const { r, other, area, sort, h24 } = filterSort(all, q);
  const catAds = S.ads.filter(a => a.ad_type === 'category_banner' && a.service_id === id && safeImg(a.image_url));
  const qs = (k, v) => { const p = new URLSearchParams(q); v == null ? p.delete(k) : p.set(k, v); const t = p.toString(); return '#/s/' + id + (t ? '?' + t : ''); };
  const otherHtml = other.length ? `<div class="sec-h" style="margin-top:22px"><h2 style="font-size:16px">مقدمو خدمة في مناطق أخرى (${fmtNum(other.length)})</h2></div><div class="stack">${other.map(lcard).join('')}</div>` : '';
  const list = !S.loaded ? '<div class="stack">' + '<div class="sk" style="height:120px"></div>'.repeat(3) + '</div>'
    : (r.length ? `<div class="stack">${r.map(lcard).join('')}</div>`
      : other.length ? `<div class="pad"><div class="note">${icon('info')}<div>ما فيه مقدم خدمة مسجّل في ${esc(area)} لهذا القسم حالياً. هذي خيارات من مناطق قريبة وأخرى:</div></div></div>`
      : emptyBox('search', all.length ? 'لا توجد نتائج مطابقة' : 'لا يوجد مقدمو خدمة في هذا القسم حالياً', all.length ? 'جرّب إزالة الفلاتر.' : 'نضيف مقدمي خدمة جدد باستمرار.', all.length ? `<a class="btn ghost" href="#/s/${esc(id)}?area=all">إزالة الفلاتر</a>` : `<a class="btn primary" href="#/join">تقدم هذه الخدمة؟ انضم الآن</a>`)) + otherHtml;
  return {
    tab: 'cats',
    html: `${topbar(s ? s.name_ar : '...', { right: `<a class="icon-btn" href="#/search" aria-label="بحث">${icon('search')}</a>` })}
    <div class="sticky-search">
      <label class="searchbar" style="margin-top:10px">${icon('search')}<input type="search" placeholder="ابحث داخل ${esc(s ? s.name_ar : 'القسم')}" value="${esc(q.get('q') || '')}" data-live="svcq" enterkeyhint="search" aria-label="بحث داخل القسم"></label>
      <div class="chips" style="margin-top:6px">
        <button class="chip ${area !== 'all' ? 'on' : 'out'}" data-act="area" data-scope="list">${icon('pin')}${esc(area === 'all' ? 'كل المناطق' : area)}${icon('chevD')}</button>
        <button class="chip out on" data-act="sort" data-cur="${sort}">${icon('sort')}${SORTS[sort]}</button>
        <a class="chip ${h24 ? 'on' : 'out'}" href="${qs('h24', h24 ? null : '1')}">${icon('clock')}24 ساعة</a>
      </div>
      <div class="chips">${S.services.map(x => `<a class="chip ${x.id === id ? 'on' : ''}" href="#/s/${esc(x.id)}">${esc(x.name_ar)}</a>`).join('')}</div>
    </div>
    ${catAds.length ? `<div style="margin:6px 0 8px">${carousel(catAds.map(a => bannerHtml(a, 'ad')))}</div>` : ''}
    ${S.loaded ? `<div class="count-line">${fmtNum(r.length)} مقدم خدمة${area !== 'all' ? ' في ' + esc(area) : ''}</div>` : ''}
    ${S.err && !S.loaded ? errBox() : list}`,
    after: el => { initCarousel(el); },
  };
}

function pgSearch(_, q) {
  const text = q.get('q') || '';
  return {
    tab: 'search',
    html: `<header class="topbar"><button class="icon-btn clear" data-act="back" aria-label="رجوع">${icon('chevR')}</button>
      <label class="searchbar" style="margin:0;flex:1;width:auto;height:48px">${icon('search')}<input id="sq" type="search" placeholder="ابحث عن خدمة أو اسم أو منطقة" value="${esc(text)}" data-live="search" enterkeyhint="search" autocomplete="off" aria-label="بحث"></label></header>
      <div id="sres">${searchResults(text)}</div>`,
    after: el => { const i = $('#sq', el); if (i && !text) setTimeout(() => i.focus(), 60); },
  };
}
function searchResults(text) {
  const t = norm(text);
  if (!t) {
    return `${S.recent.length ? `<div class="sec-h" style="margin-top:14px"><h2 style="font-size:16px">عمليات البحث الأخيرة</h2><button class="more" data-act="clear-recent">مسح</button></div><div class="chips" style="flex-wrap:wrap">${S.recent.map(r => `<a class="chip out" href="#/search?q=${encodeURIComponent(r)}">${icon('clock')}${esc(r)}</a>`).join('')}</div>` : ''}
      <div class="sec-h" style="margin-top:20px"><h2 style="font-size:16px">تصفّح حسب الخدمة</h2></div>
      <div class="cat-list">${S.services.map(s => `<a class="cat-row" href="#/s/${esc(s.id)}"><span class="ic tile t-${esc(s.icon || s.id)}">${svcIcon(s)}</span><span><b>${esc(s.name_ar)}</b></span>${icon('chevL', 'chev')}</a>`).join('')}</div>`;
  }
  const cats = S.services.filter(s => norm(s.name_ar).includes(t) || t.split(' ').some(w => w.length > 1 && norm(s.name_ar).includes(w)));
  const syn = { 'ونش': 'tow', 'سطحه': 'tow', 'سحب': 'tow', 'بنشر': 'tire', 'تاير': 'tire', 'اطار': 'tire', 'كفر': 'tire', 'مفتاح': 'keys', 'ريموت': 'keys', 'غسيل': 'wash', 'تلميع': 'wash', 'تظليل': 'shield', 'نانو': 'shield', 'حمايه': 'shield', 'بطاريه': 'bat', 'بطارية': 'bat', 'كهرباء': 'bat', 'ميكانيك': 'mech', 'صيانه': 'mech' };
  const synIds = new Set(Object.entries(syn).filter(([k]) => t.includes(norm(k))).map(([, v]) => v));
  synIds.forEach(id => { const s = svc(id); if (s && !cats.includes(s)) cats.push(s); });
  const cos = S.cos.filter(c => synIds.has(c.s) || norm([c.name, c.desc, c.price, svcName(c.s), c.areas.join(' ')].join(' ')).includes(t));
  return `${cats.length ? `<div class="chips" style="margin-top:10px;flex-wrap:wrap">${cats.map(s => `<a class="chip" href="#/s/${esc(s.id)}">${svcIcon(s)}${esc(s.name_ar)}</a>`).join('')}</div>` : ''}
    <div class="count-line" style="margin-top:12px">${fmtNum(cos.length)} نتيجة</div>
    ${cos.length ? `<div class="stack">${cos.map(lcard).join('')}</div>` : emptyBox('search', 'ما لقينا نتائج', 'جرّب كلمة ثانية مثل: ونش، بنشر، بطارية.')}`;
}

async function pgCompany([id]) {
  const c = coById(id);
  if (!S.loaded) return { hideTabs: true, html: topbar('') + '<div class="pad"><div class="sk" style="height:260px;margin-top:10px"></div></div>' };
  if (!c) return { hideTabs: true, html: topbar('مقدم الخدمة') + emptyBox('store', 'مقدم الخدمة غير متاح', 'ممكن يكون اشتراكه منتهي أو تم إيقافه.', '<a class="btn primary" href="#/">الرئيسية</a>') };
  track('company_view', c.id);
  const fav = S.favs.has(c.id);
  const photos = c.photos.slice(0, 9);
  return {
    hideTabs: true,
    html: `<div class="hero-media">${c.cover ? `<img src="${esc(c.cover)}" alt="">` : c.logo ? `<img class="fit" src="${esc(c.logo)}" alt="" style="object-fit:contain;background:#fff;padding:30px">` : `<div class="ph-media">${svcIcon(svc(c.s) || c.s)}</div>`}
      <div class="hero-top"><button class="icon-btn" data-act="back" aria-label="رجوع">${icon('chevR')}</button><div class="g"><button class="icon-btn" data-act="share" data-id="${c.id}" aria-label="مشاركة">${icon('share')}</button><button class="icon-btn ${fav ? 'on' : ''}" data-act="fav" data-id="${c.id}" aria-label="المفضلة">${icon('heart')}</button></div></div></div>
    <div class="detail">
      ${c.cover && c.logo ? `<div class="logo-av"><img src="${esc(c.logo)}" alt=""></div>` : ''}
      <h1>${esc(c.name)}</h1>
      <div class="tagline"><a class="tg" href="#/s/${esc(c.s)}">${svcIcon(svc(c.s) || c.s)}${esc(svcName(c.s))}</a>${c.feat ? '<span class="tg y">مميز</span>' : ''}${c.h24 ? `<span class="tg">${icon('clock')}24 ساعة</span>` : ''}${c.avail ? '<span class="tg ok">متاح</span>' : '<span class="tg warn">غير متاح حالياً</span>'}${rateHtml(c)}</div>
    </div>
    <div class="pad" style="display:grid;gap:16px;margin-top:6px">
      <div class="kv">
        <div class="r">${icon('pin')}<span><b>مناطق الخدمة</b><div>${c.areas.length ? c.areas.map(esc).join('، ') : 'كل الكويت'}${distTxt(c) ? ` · يبعد عنك ${distTxt(c)}` : ''}</div></span></div>
        ${c.price ? `<div class="r">${icon('card')}<span><b>الأسعار</b><div>${esc(c.price)}</div></span></div>` : ''}
        ${c.addr ? `<div class="r">${icon('map')}<span><b>العنوان</b><div>${esc(c.addr)}</div></span></div>` : ''}
        <div class="r">${icon('phone')}<span><b>رقم التواصل</b><div dir="ltr" style="text-align:right">+965 ${esc(c.phone || c.wa)}</div></span></div>
      </div>
      ${c.desc ? `<div><div class="lbl" style="margin-bottom:8px">عن مقدم الخدمة</div><div style="font-size:15px;line-height:1.9;white-space:pre-line;color:var(--ink2)">${esc(c.desc)}</div></div>` : ''}
      ${c.lat != null && c.lng != null ? `<div><div class="lbl" style="margin-bottom:8px">الموقع</div><div class="minimap" id="minimap" dir="ltr"></div><a class="btn line block" style="margin-top:8px" target="_blank" rel="noopener" href="https://maps.google.com/?q=${+c.lat},${+c.lng}">${icon('external')}فتح في الخرائط</a></div>` : ''}
      ${photos.length ? `<div><div class="lbl" style="margin-bottom:8px">الصور</div><div class="gallery">${photos.map((p, i) => `<button data-act="photo" data-i="${i}" data-id="${c.id}"><img src="${esc(p)}" alt="" loading="lazy"></button>`).join('')}</div></div>` : ''}
      <div id="reviews"><div class="lbl">التقييمات</div><div class="sk" style="height:60px;margin-top:8px"></div></div>
      <div class="note">${icon('shieldc')}<div>التعامل والدفع يتم مباشرة مع مقدم الخدمة. واجهت مشكلة؟ <a href="${waHref(supportWa(), 'بلاغ بخصوص مقدم الخدمة: ' + c.name + ' (#' + c.id + ')')}" target="_blank" rel="noopener" style="font-weight:800;text-decoration:underline">أبلغ الإدارة</a></div></div>
    </div>
    <div class="sticky-cta"><a class="btn dark" href="${telHref(c.phone || c.wa)}" data-track="call" data-id="${c.id}">${icon('phone')}اتصال</a><a class="btn wa" href="${waHref(c.wa || c.phone, waText(c))}" target="_blank" rel="noopener" data-track="whatsapp" data-id="${c.id}">${icon('wa')}واتساب</a></div>`,
    after: async el => {
      if (c.lat != null && c.lng != null) loadLeaflet().then(L => { const box = $('#minimap', el); if (!box) return; const m = L.map(box, { zoomControl: false, dragging: false, scrollWheelZoom: false, attributionControl: false }).setView([c.lat, c.lng], 14); tileLayer(L).addTo(m); L.marker([c.lat, c.lng], { icon: markerIcon(L) }).addTo(m); }).catch(() => { });
      loadReviews(c, el);
    },
  };
}
async function loadReviews(c, el) {
  const box = $('#reviews', el); if (!box) return;
  let list = [];
  try { list = await rest(`reviews?select=id,rating,comment,created_at,user_id&company_id=eq.${c.id}&is_hidden=eq.false&order=created_at.desc&limit=30`, { anon: true }) || []; } catch (_) { }
  const ses = session(); const mine = ses && list.find(r => r.user_id === ses.uid);
  if (!box.isConnected) return;
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div class="lbl">التقييمات ${list.length ? `(${list.length})` : ''}</div>${mine ? '<span class="tg ok">قيّمت هذا المقدم</span>' : `<button class="btn xs ghost" data-act="review" data-id="${c.id}">${icon('star')}أضف تقييمك</button>`}</div>
    ${list.length ? `<div style="display:grid;gap:8px">${list.map(r => `<div class="review"><div class="h"><span class="rate">${icon('star')}${r.rating}</span><span>${fmtDate(r.created_at)}</span></div>${r.comment ? `<p>${esc(r.comment)}</p>` : ''}</div>`).join('')}</div>` : '<div class="note">' + icon('star') + '<div>لا توجد تقييمات بعد. التقييمات تُكتب فقط من عملاء مسجّلين.</div></div>'}`;
}
async function reviewSheet(id) {
  if (!(await ensureAuth('سجّل دخولك لإضافة تقييم'))) return;
  let val = 0;
  sheet(`<div class="sheet-h"><h3>قيّم مقدم الخدمة</h3><button class="icon-btn clear" data-close>${icon('close')}</button></div>
    <div class="sheet-body"><div class="stars" id="stars">${[1, 2, 3, 4, 5].map(n => `<button data-n="${n}" aria-label="${n}">${icon('star')}</button>`).join('')}</div>
    <textarea class="inp" id="rvc" maxlength="500" placeholder="اكتب تجربتك (اختياري)"></textarea><button class="btn primary block" id="rvs">إرسال التقييم</button></div>`, {
    onOpen: sh => {
      $$('#stars button', sh).forEach(b => b.onclick = () => { val = +b.dataset.n; $$('#stars button', sh).forEach(x => x.classList.toggle('on', +x.dataset.n <= val)); });
      $('#rvs', sh).onclick = e => busy(e.currentTarget, async () => {
        if (!val) return toast('اختر عدد النجوم');
        try { await rest('reviews', { method: 'POST', body: { company_id: +id, rating: val, comment: $('#rvc', sh).value.trim() || null }, prefer: 'return=minimal' }); closeSheet(); toast('شكراً لتقييمك', 'ok'); render(true); }
        catch (err) { toast(errText(err), 'err'); }
      }, 'جاري الإرسال...');
    }
  });
}

/* ---------- الحسابات ---------- */
function authForm(mode, title) {
  return `<div class="seg" role="tablist"><button data-mode="login" class="${mode === 'login' ? 'on' : ''}">تسجيل الدخول</button><button data-mode="register" class="${mode === 'register' ? 'on' : ''}">حساب جديد</button></div>
    ${title ? `<div class="note y">${icon('info')}<div>${esc(title)}</div></div>` : ''}
    <form class="form" style="padding:0" data-auth="${mode}" novalidate>
      ${mode === 'register' ? `<div class="field"><label for="an">الاسم</label><input class="inp" id="an" autocomplete="name" maxlength="80" placeholder="اسمك"></div>` : ''}
      <div class="field"><label for="ap">رقم الهاتف</label><div class="inp-wrap has-prefix"><span class="prefix">+965</span><input class="inp ltr" id="ap" inputmode="numeric" autocomplete="tel-national" maxlength="12" placeholder="XXXXXXXX" ${mode === 'login' ? '' : ''}></div>${mode === 'login' ? '<span class="hint">أو اكتب البريد الإلكتروني إذا كان حسابك قديماً بالإيميل.</span>' : ''}</div>
      <div class="field"><label for="apw">كلمة السر</label><div class="inp-wrap"><input class="inp" id="apw" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" maxlength="72" placeholder="${mode === 'register' ? '8 خانات على الأقل (أرقام وحروف)' : 'كلمة السر'}"><button type="button" class="suffix" data-act="showpw" aria-label="إظهار كلمة السر">${icon('eye')}</button></div></div>
      <button class="btn primary block" type="submit">${mode === 'login' ? 'دخول' : 'إنشاء الحساب'}</button>
      ${mode === 'login' ? '<button type="button" class="btn ghost block" data-act="forgot">نسيت كلمة السر؟</button>' : `<div class="note">${icon('shieldc')}<div>ما نرسل رسائل تحقق. رقم الهاتف يُستخدم للدخول فقط ولا يُعتبر موثّقاً.</div></div>`}
    </form>`;
}
function bindAuth(root, done, title) {
  const draw = mode => {
    const host = $('[data-auth-host]', root); host.innerHTML = authForm(mode, title);
    $$('.seg button', host).forEach(b => b.onclick = () => draw(b.dataset.mode));
    const f = $('form', host);
    f.onsubmit = e => {
      e.preventDefault();
      const btn = $('button[type=submit]', f);
      busy(btn, async () => {
        const ph = $('#ap', f).value.trim(), pw = $('#apw', f).value;
        try {
          if (mode === 'register') {
            if (!localPhone(ph) || /^2/.test(localPhone(ph))) throw new Error('invalid phone');
            if (pw.length < 8 || !/\d/.test(pw) || !/\D/.test(pw)) throw new Error('weak password');
            await register(ph, pw, $('#an', f).value.trim());
            toast('تم إنشاء حسابك', 'ok');
          } else {
            if (!ph || !pw) return toast('اكتب رقم الهاتف وكلمة السر');
            await login(ph, pw); toast('أهلاً بك', 'ok');
          }
          await loadMe(); done && done(true);
        } catch (err) { toast(errText(err), 'err'); }
      }, mode === 'login' ? 'جاري الدخول...' : 'جاري الإنشاء...');
    };
  };
  draw('login');
}
function ensureAuth(title) {
  if (session()) return Promise.resolve(true);
  return new Promise(res => {
    let ok = false;
    const sh = sheet(`<div class="sheet-h"><h3>حسابك في ماتعطل</h3><button class="icon-btn clear" data-close>${icon('close')}</button></div><div class="sheet-body" data-auth-host></div>`);
    bindAuth(sh, v => { ok = v; closeSheet(); res(true); }, title);
    const bg = $('#sheetBg'); const obs = new MutationObserver(() => { if (!bg.isConnected) { obs.disconnect(); if (!ok) res(false); } }); obs.observe(document.body, { childList: true });
  });
}
function forgotSheet() {
  sheet(`<div class="sheet-h"><h3>استرجاع كلمة السر</h3><button class="icon-btn clear" data-close>${icon('close')}</button></div>
    <div class="sheet-body"><div class="note">${icon('key2')}<div>استخدم <b>رمز الاسترجاع</b> اللي أنشأته من صفحة حسابي. ما عندك رمز؟ تواصل مع الدعم من رقمك المسجّل.</div></div>
    <div class="field"><label>رقم الهاتف</label><input class="inp ltr" id="fp" inputmode="numeric" maxlength="12" placeholder="XXXXXXXX"></div>
    <div class="field"><label>رمز الاسترجاع</label><input class="inp ltr" id="fc" autocapitalize="characters" placeholder="XXXXXX-XXXXXX-XXXXXX"></div>
    <div class="field"><label>كلمة السر الجديدة</label><input class="inp" id="fnp" type="password" autocomplete="new-password" placeholder="8 خانات على الأقل (أرقام وحروف)"></div>
    <button class="btn primary block" id="fgo">تغيير كلمة السر</button>
    <a class="btn ghost block" target="_blank" rel="noopener" href="${waHref(supportWa(), 'السلام عليكم، نسيت كلمة السر لحسابي في ماتعطل')}">${icon('wa')}تواصل مع الدعم</a></div>`, {
    onOpen: sh => $('#fgo', sh).onclick = e => busy(e.currentTarget, async () => {
      const p = localPhone($('#fp', sh).value), c = $('#fc', sh).value.trim(), np = $('#fnp', sh).value;
      if (!p) return toast(errText('invalid phone'), 'err');
      if (np.length < 8 || !/\d/.test(np) || !/\D/.test(np)) return toast(errText('weak password'), 'err');
      try { const ok = await rpc('reset_password_with_recovery', { p_phone: p, p_code: c, p_new_password: np }, { anon: true }); if (ok) { closeSheet(); toast('تم تغيير كلمة السر. سجّل الدخول الآن.', 'ok'); } else toast('الرمز غير صحيح أو مقفل مؤقتاً.', 'err'); }
      catch (err) { toast(errText(err), 'err'); }
    })
  });
}
function pgAuth(_, q) {
  const next = q.get('next') || '/account';
  if (session()) { setTimeout(() => go(next, true)); return { html: '' }; }
  return {
    tab: 'account',
    html: `${topbar('حسابك')}<div class="page-title" style="margin-top:8px"><h1>أهلاً بك في ماتعطل</h1><p>التسجيل اختياري للعملاء. تقدر تتصفح وتتواصل بدون حساب.</p></div><div class="sheet-body" style="margin-top:16px" data-auth-host></div>`,
    after: el => bindAuth(el, () => go(next, true)),
  };
}
function pgAccount() {
  const ses = session(), p = S.profile;
  const menuItem = (href, ic, t, extra = '') => `<a href="${href}"><span class="ic">${icon(ic)}</span>${esc(t)}${extra || icon('chevL', 'chev')}</a>`;
  const common = `<div class="menu-title">ماتعطل</div><div class="menu">
      ${menuItem('#/advertise', 'megaphone', 'أعلن معنا')}${menuItem('#/join', 'store', 'انضم كمقدم خدمة')}
      <a href="${waHref(supportWa(), 'السلام عليكم، عندي استفسار بخصوص ماتعطل')}" target="_blank" rel="noopener"><span class="ic">${icon('wa')}</span>تواصل مع الدعم${icon('chevL', 'chev')}</a>
      ${menuItem('#/about', 'info', 'عن ماتعطل والخصوصية')}
      <button data-act="install"><span class="ic">${icon('download')}</span>تثبيت التطبيق${icon('chevL', 'chev')}</button>
      <button data-act="theme"><span class="ic">${icon('eye')}</span>المظهر: ${({ auto: 'تلقائي', light: 'فاتح', dark: 'داكن' })[store.get('theme', 'auto')]}${icon('chevL', 'chev')}</button></div>`;
  if (!ses) return {
    tab: 'account',
    html: `<header class="topbar"><h1 style="font-size:24px">حسابي</h1></header>
    <div class="acc-head"><div class="av">${icon('user')}</div><h2>سجّل دخولك</h2><p>احفظ المفضلة، تابع طلبات الانضمام والإعلانات.</p><div class="row2"><a class="btn primary" href="#/auth">دخول</a><a class="btn ghost" href="#/auth?m=register" data-act="goreg">حساب جديد</a></div></div>
    <div class="menu-title">حسابي</div><div class="menu">${menuItem('#/favorites', 'heart', 'المفضلة')}</div>${common}
    <div class="footer-note">الإصدار ${VERSION}</div>`,
  };
  const name = (p && p.full_name) || 'مستخدم ماتعطل';
  return {
    tab: 'account',
    html: `<header class="topbar"><h1 style="font-size:24px">حسابي</h1></header>
    <div class="acc-head"><div class="av">${esc(name.trim()[0] || 'م')}</div><h2>${esc(name)}</h2><p dir="ltr" style="text-align:right">${p && p.phone ? '+965 ' + esc(p.phone) : esc(ses.email)}</p>${p && p.phone ? '<p style="font-size:12px;margin-top:4px">رقم غير موثّق — يُستخدم لتسجيل الدخول فقط</p>' : ''}</div>
    ${S.isAdmin ? `<div class="pad" style="margin-top:12px"><a class="btn dark block" href="admin.html">${icon('chart')}لوحة الإدارة</a></div>` : ''}
    <div class="menu-title">حسابي</div><div class="menu">
      ${menuItem('#/notifications', 'bell', 'الإشعارات', `<span class="cnt" id="ncnt" hidden></span>`)}
      ${menuItem('#/favorites', 'heart', 'المفضلة')}${menuItem('#/my-business', 'store', 'نشاطي التجاري')}${menuItem('#/my-ads', 'megaphone', 'إعلاناتي')}
      <button data-act="edit-name"><span class="ic">${icon('edit')}</span>تعديل الاسم${icon('chevL', 'chev')}</button>
      <button data-act="change-pw"><span class="ic">${icon('lock')}</span>تغيير كلمة السر${icon('chevL', 'chev')}</button>
      <button data-act="recovery"><span class="ic">${icon('key2')}</span>رمز استرجاع كلمة السر${icon('chevL', 'chev')}</button></div>
    ${common}
    <div class="menu-title">الجلسة</div><div class="menu"><button data-act="logout"><span class="ic">${icon('logout')}</span>تسجيل الخروج</button><button data-act="delete-account" class="danger"><span class="ic">${icon('trash')}</span>حذف الحساب</button></div>
    <div class="footer-note">الإصدار ${VERSION}</div>`,
    after: async () => { try { const r = await rest('notifications?select=id&read_at=is.null&limit=50'); const n = (r || []).length; const b = $('#ncnt'); if (b && n) { b.hidden = false; b.textContent = n; } } catch (_) { } },
  };
}
function pgFavorites() {
  const list = S.cos.filter(c => S.favs.has(c.id));
  return {
    tab: 'account',
    html: `<header class="topbar"><h1 style="font-size:24px">المفضلة</h1></header>
    ${!S.loaded ? '<div class="stack"><div class="sk" style="height:120px"></div></div>' : list.length ? `<div class="stack">${list.map(lcard).join('')}</div>` : emptyBox('heart', 'ما عندك مفضلة بعد', 'اضغط على القلب في أي مقدم خدمة لحفظه هنا والوصول له بسرعة.', '<a class="btn primary" href="#/categories">تصفّح الأقسام</a>')}
    ${!session() && list.length ? `<div class="pad" style="margin-top:14px"><div class="note">${icon('info')}<div>المفضلة محفوظة على هذا الجهاز. <a href="#/auth?next=/favorites" style="font-weight:800;text-decoration:underline">سجّل دخولك</a> لحفظها في حسابك.</div></div></div>` : ''}`,
  };
}
async function pgNotifications() {
  if (!session()) return { html: topbar('الإشعارات') + emptyBox('bell', 'سجّل دخولك', '', '<a class="btn primary" href="#/auth?next=/notifications">دخول</a>') };
  let list = [];
  try { list = await rest('notifications?select=id,title,body,created_at,read_at&order=created_at.desc&limit=50') || []; } catch (e) { return { html: topbar('الإشعارات') + emptyBox('refresh', 'تعذّر التحميل', errText(e)) }; }
  const unread = list.filter(n => !n.read_at).map(n => n.id);
  if (unread.length) rest('notifications?id=in.(' + unread.join(',') + ')', { method: 'PATCH', body: { read_at: new Date().toISOString() }, prefer: 'return=minimal' }).catch(() => { });
  return {
    tab: 'account',
    html: topbar('الإشعارات') + (list.length ? `<div class="stack" style="margin-top:12px">${list.map(n => `<div class="item-card" style="${n.read_at ? '' : 'border-color:var(--ink)'}"><b>${esc(n.title)}</b>${n.body ? `<div style="color:var(--ink2);font-size:14px">${esc(n.body)}</div>` : ''}<small style="color:var(--mut)">${fmtDate(n.created_at)}</small></div>`).join('')}</div>` : emptyBox('bell', 'لا توجد إشعارات', 'نبلغك هنا عند الموافقة على طلباتك وإعلاناتك.')),
  };
}

/* ---------- انضم الآن ---------- */
const statusTag = c => {
  const t = todayISO();
  if (c.status === 'pending') return '<span class="tg warn">بانتظار موافقة الإدارة</span>';
  if (c.status === 'rejected') return '<span class="tg bad">مرفوض</span>';
  if (c.status === 'suspended' || !c.is_active) return '<span class="tg bad">موقوف</span>';
  if (c.sub_end && c.sub_end < t) return '<span class="tg warn">الاشتراك منتهي</span>';
  return '<span class="tg ok">ظاهر للعملاء</span>';
};
async function myCompanies() {
  const ses = session(); if (!ses) return [];
  return await rest('companies?select=id,name,service_id,status,is_active,sub_end,visits,calls,wa_taps,logo_url,created_at&owner_id=eq.' + ses.uid + '&order=created_at.desc') || [];
}
async function pgMyBusiness() {
  if (!session()) return { html: topbar('نشاطي التجاري') + emptyBox('store', 'سجّل دخولك', 'لمتابعة طلب انضمامك.', '<a class="btn primary" href="#/auth?next=/my-business">دخول</a>') };
  let list = [];
  try { list = await myCompanies(); } catch (e) { return { html: topbar('نشاطي التجاري') + emptyBox('refresh', 'تعذّر التحميل', errText(e)) }; }
  return {
    tab: 'req',
    html: topbar('نشاطي التجاري') + (list.length ? `<div class="stack" style="margin-top:12px">${list.map(c => `<div class="item-card"><div class="top">${safeImg(c.logo_url) ? `<img src="${esc(safeImg(c.logo_url))}" alt="">` : `<span class="ph">${svcIcon(svc(c.service_id) || c.service_id)}</span>`}<div style="flex:1;min-width:0"><b>${esc(c.name)}</b><small style="color:var(--mut)">${esc(svcName(c.service_id))}</small></div></div>
      <div class="tagline">${statusTag(c)}${c.status === 'approved' && c.sub_end ? `<span class="tg">الاشتراك حتى ${fmtDate(c.sub_end)}</span>` : ''}</div>
      ${c.status === 'approved' ? `<div class="stats3"><div><b>${fmtNum(c.visits)}</b><small>مشاهدة</small></div><div><b>${fmtNum(c.calls)}</b><small>اتصال</small></div><div><b>${fmtNum(c.wa_taps)}</b><small>واتساب</small></div></div>` : ''}
      ${c.status === 'pending' ? `<div class="note">${icon('clock')}<div>طلبك قيد المراجعة. ما يظهر نشاطك للعامة إلا بعد موافقة الإدارة وتفعيل الاشتراك.</div></div>` : ''}
      <a class="btn sm ghost" target="_blank" rel="noopener" href="${waHref(supportWa(), 'السلام عليكم، بخصوص نشاطي في ماتعطل: ' + c.name + ' (#' + c.id + ')')}">${icon('wa')}تواصل مع الإدارة</a></div>`).join('')}<a class="btn line block" href="#/join?new=1">${icon('plus')}إضافة نشاط آخر</a></div>`
        : emptyBox('store', 'ما عندك نشاط مسجّل', 'قدّم طلب انضمام ليظهر نشاطك لعملاء ماتعطل بعد موافقة الإدارة.', '<a class="btn primary" href="#/join">انضم الآن</a>')),
  };
}
async function pgJoin(_, q) {
  const ses = session();
  if (ses && !q.get('new')) {
    let mine = [];
    try { mine = await myCompanies(); } catch (_) { }
    if (mine.length) return {
      tab: 'account',
      html: `${topbar('انضم الآن')}<div class="pad" style="margin-top:12px"><div class="note y">${icon('info')}<div>عندك ${mine.length === 1 ? 'نشاط مسجّل' : mine.length + ' أنشطة مسجّلة'}. تابع حالته من «طلباتي».</div></div></div>
        <div class="pad" style="margin-top:12px;display:grid;gap:10px"><a class="btn primary block" href="#/requests?t=biz">طلباتي</a><a class="btn line block" href="#/join?new=1">${icon('plus')}تسجيل نشاط آخر</a></div>`,
    };
  }
  const prof = S.profile || {};
  return {
    tab: 'account',
    html: `${topbar('انضم الآن')}
    <div class="join-hero"><span class="ic">${icon('store')}</span><div><b>سجّل نشاطك في دقيقة</b><small>التسجيل مجاني${monthlyPrice() != null ? ' — الاشتراك ' + kwd(monthlyPrice()) + ' شهرياً بعد الموافقة' : ''}</small></div></div>
    <div class="pad" style="margin-top:12px">${plansHtml()}</div>
    <form class="form" id="joinf" novalidate style="margin-top:14px">
      <div class="field"><label for="jn">اسم النشاط</label><input class="inp" id="jn" maxlength="100" placeholder="مثال: ونش السالمية" autocomplete="organization"></div>
      <div class="field"><label for="jsvc">الخدمة</label><select class="inp" id="jsvc">${S.services.map(s => `<option value="${esc(s.id)}">${esc(s.name_ar)}</option>`).join('')}</select></div>
      <div class="field"><label for="jp">رقم الهاتف</label><div class="inp-wrap has-prefix"><span class="prefix">+965</span><input class="inp ltr" id="jp" inputmode="numeric" maxlength="12" value="${esc(prof.phone || '')}" placeholder="XXXXXXXX" autocomplete="tel-national"></div></div>
      ${ses ? '' : `<div class="field"><label for="jpw">كلمة سر لحسابك</label><div class="inp-wrap"><input class="inp" id="jpw" type="password" autocomplete="new-password" maxlength="72" placeholder="8 خانات أو أكثر (أرقام وحروف)"><button type="button" class="suffix" data-act="showpw" aria-label="إظهار">${icon('eye')}</button></div><span class="hint">عندك حساب؟ اكتب كلمة السر نفسها وبندخلك تلقائياً.</span></div>`}
      <button class="btn primary block" type="submit">إرسال الطلب</button>
      <details class="more-opts"><summary>${icon('plus')}تفاصيل إضافية <small>(اختياري)</small></summary><div class="form" style="padding:12px 0 0">
        <div class="field"><label for="jar">المنطقة</label><select class="inp" id="jar"><option value="">كل الكويت</option>${S.areas.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}</select></div>
        <div class="field"><label for="jw">رقم واتساب مختلف</label><div class="inp-wrap has-prefix"><span class="prefix">+965</span><input class="inp ltr" id="jw" inputmode="numeric" maxlength="12" placeholder="اتركه فارغاً إذا نفس الرقم"></div></div>
        <div class="field"><label for="jd">وصف أو أسعار</label><textarea class="inp" id="jd" maxlength="1500" placeholder="خدماتك، أوقاتك، أسعارك"></textarea></div>
        <button type="button" class="switch" id="j24"><span><b>متاح 24 ساعة</b></span><span class="tgl"></span></button>
        <div class="field"><span class="lbl">الشعار</span><label class="upload"><input type="file" id="jl" accept="image/jpeg,image/png,image/webp"><span class="pv" id="jlp">${icon('image')}</span><span><b>اختر صورة</b><small>اختياري</small></span></label></div>
        <button type="button" class="btn line block" id="jmap">${icon('map')}<span>موقعك على الخريطة</span></button>
      </div></details>
    </form>`,
    after: el => bindJoin(el),
  };
}
function bindJoin(el) {
  const f = $('#joinf', el); let pos = null, h24 = false;
  $('#j24', f).onclick = e => { h24 = !h24; $('.tgl', e.currentTarget).classList.toggle('on', h24); };
  $('#jl', f).onchange = e => previewFile(e.target, $('#jlp', f));
  $('#jmap', f).onclick = async e => { const p = await pickOnMap(pos || S.pos); if (p) { pos = p; $('span', e.currentTarget).textContent = 'تم تحديد الموقع ✓'; } };
  f.onsubmit = ev => {
    ev.preventDefault();
    busy($('button[type=submit]', f), async () => {
      const name = $('#jn', f).value.trim(), sv = $('#jsvc', f).value, area = $('#jar', f).value;
      const ph = localPhone($('#jp', f).value), wa = $('#jw', f).value.trim() ? localPhone($('#jw', f).value) : ph;
      if (name.length < 2) return toast('اكتب اسم النشاط', 'err');
      if (!ph) return toast('اكتب رقم هاتف صحيح من 8 أرقام', 'err');
      if (!wa) return toast('رقم الواتساب غير صحيح', 'err');
      try {
        if (!session()) {
          const pw = $('#jpw', f).value;
          if (pw.length < 8 || !/\d/.test(pw) || !/\D/.test(pw)) return toast(errText('weak password'), 'err');
          if (/^2/.test(ph)) return toast('للتسجيل استخدم رقم موبايل', 'err');
          try { await register(ph, pw, name); }
          catch (e) {
            if (!/already registered/.test(e.message)) throw e;
            try { await login(ph, pw); } catch (_) { return toast('هذا الرقم مسجّل. اكتب كلمة السر الصحيحة لحسابك.', 'err'); }
          }
          await loadMe();
        }
        const ses = session(); if (!ses) throw new Error('session');
        let logo = null; const file = $('#jl', f).files[0];
        if (file) logo = await upload('company-media', ses.uid + '/logo-' + rnd() + '.jpg', await shrinkImage(file, 800));
        const desc = $('#jd', f).value.trim() || null;
        const body = { owner_id: ses.uid, name, service_id: sv, phone: ph, whatsapp: wa, description: desc, is_24h: h24, status: 'pending', is_active: false, logo_url: logo };
        if (pos) { body.lat = pos.lat; body.lng = pos.lng; }
        const r = await rest('companies', { method: 'POST', body, prefer: 'return=representation' });
        const cid = r && r[0] && r[0].id; if (!cid) throw new Error('no id');
        if (area) {
          const areaRows = await rest('areas?select=id,name_ar', { anon: true });
          const ids = (areaRows || []).filter(a => a.name_ar === area).map(a => ({ company_id: cid, area_id: a.id }));
          if (ids.length) await rest('company_areas', { method: 'POST', body: ids, prefer: 'return=minimal' });
        }
        $('#view').innerHTML = `${topbar('انضم الآن')}<div class="success"><div class="ok">${icon('check')}</div><h2>وصلنا طلبك</h2><p>«${esc(name)}» قيد المراجعة. بنبلغك بعد موافقة الإدارة.</p>
          <a class="btn wa block" target="_blank" rel="noopener" href="${waHref(supportWa(), 'السلام عليكم، سجلت نشاط «' + name + '» في ماتعطل (#' + cid + ') وأبي تفعيل الاشتراك')}">${icon('wa')}تواصل لتسريع التفعيل</a><a class="btn ghost block" href="#/requests?t=biz">متابعة الطلب</a></div>`;
      } catch (err) { toast(errText(err), 'err'); }
    }, 'جاري الإرسال...');
  };
}
function previewFile(input, box) {
  const f = input.files && input.files[0]; if (!f) return;
  if (f.size > 12 * 1024 * 1024) { input.value = ''; return toast('حجم الصورة كبير جداً', 'err'); }
  const u = URL.createObjectURL(f); box.innerHTML = `<img src="${u}" alt="">`;
}

/* ---------- الأسعار ---------- */
const kwd = n => fmtNum(n) + ' د.ك';
const adPrice = (type, days) => { const t = (S.settings.ad_prices || {})[type] || {}; const v = t[String(days)]; return v == null ? null : Number(v); };
const monthlyPrice = () => { const m = (S.plans || []).filter(p => p.months === 1); return m.length ? Math.min(...m.map(p => Number(p.price_kwd))) : null; };
function plansHtml() {
  if (!S.plans || !S.plans.length) return '';
  const base = monthlyPrice();
  return `<div class="plans">${S.plans.map(p => { const save = base && p.months > 1 ? Math.round((1 - p.price_kwd / (base * p.months)) * 100) : 0;
    return `<div class="plan ${p.months === 1 ? 'hl' : ''}"><small>${esc(String(p.name_ar).replace('اشتراك ', ''))}</small><b>${kwd(p.price_kwd)}</b>${save > 0 ? `<span class="save">وفّر ${save}%</span>` : '<span class="save mo">الأساسي</span>'}</div>`; }).join('')}</div>`;
}
/* ---------- أعلن معنا ---------- */
const AD_TYPES = [
  { id: 'home_banner', t: 'بانر الصفحة الرئيسية', d: 'يظهر في أعلى الصفحة الرئيسية لكل الزوار', ic: 'layers' },
  { id: 'category_banner', t: 'بانر داخل قسم', d: 'يظهر داخل قسم خدمة محدد تختاره', ic: 'grid' },
  { id: 'featured', t: 'مقدم خدمة مميز', d: 'يظهر نشاطك في قسم «المميز» مع شارة مميزة', ic: 'star' },
];
const DURS = [7, 14, 30, 60, 90];
function pgAdvertise() {
  return {
    tab: 'ad',
    html: `${topbar('أعلن معنا')}
    <div class="intro-card"><span class="k">إعلانات ماتعطل</span><h2>وصل إعلانك لأصحاب السيارات في الكويت</h2><p>قدّم طلبك، والإدارة تراجعه وتتواصل معك بالسعر. ما يظهر أي إعلان إلا بعد الموافقة وتأكيد الدفع.</p>
      <div class="steps"><div><span>1</span>أرسل طلب الإعلان</div><div><span>2</span>مراجعة وتأكيد السعر والدفع</div><div><span>3</span>يبدأ الإعلان بالمدة المحددة مع إحصائيات مشاهدات فعلية</div></div><span class="art">${icon('megaphone')}</span></div>
    <form class="form" id="adf" novalidate style="margin-top:18px">
      <div class="field"><span class="lbl">المعلن</span><div class="seg" id="akind"><button type="button" class="on" data-v="individual">فرد</button><button type="button" data-v="company">شركة</button></div></div>
      <div class="field"><label for="aname">اسم المعلن *</label><input class="inp" id="aname" maxlength="80" placeholder="الاسم أو اسم الشركة" value="${esc((S.profile && S.profile.full_name) || '')}"></div>
      <div class="field"><label for="aphone">رقم الهاتف *</label><div class="inp-wrap has-prefix"><span class="prefix">+965</span><input class="inp ltr" id="aphone" inputmode="numeric" maxlength="12" placeholder="XXXXXXXX" value="${esc((S.profile && S.profile.phone) || '')}"></div></div>
      <div class="field"><span class="lbl">نوع الإعلان *</span><div class="opt-grid" id="atype">${AD_TYPES.map((a, i) => `<button type="button" class="opt ${i === 0 ? 'on' : ''}" data-v="${a.id}"><span class="ic">${icon(a.ic)}</span><span><b>${a.t}</b><small>${a.d}</small></span><span class="rad"></span></button>`).join('')}</div></div>
      <div class="field" id="asvcw" hidden><label for="asvc">القسم</label><select class="inp" id="asvc">${S.services.map(s => `<option value="${esc(s.id)}">${esc(s.name_ar)}</option>`).join('')}</select></div>
      <div class="field" id="acow" hidden><label for="aco">النشاط المراد تمييزه</label><select class="inp" id="aco"><option value="">— سجّل دخولك لعرض أنشطتك —</option></select><span class="hint">لازم يكون عندك نشاط مسجّل في ماتعطل. <a href="#/join" style="text-decoration:underline;font-weight:800">سجّل نشاطك</a></span></div>
      <div class="field"><span class="lbl">صورة الإعلان *</span><label class="upload wide" id="aup"><input type="file" id="aimg" accept="image/jpeg,image/png,image/webp"><span class="pv" id="aimgp">${icon('image')}</span><span><b>اختر صورة</b><small>تقدر تحرّكها وتكبّرها لتغطي الإعلان بالكامل</small></span></label>
        <div id="aprev" hidden><div class="ad-preview"><img id="aprevimg" alt="معاينة الإعلان"><span class="adtag">إعلان</span></div><div class="row2" style="margin-top:8px"><button type="button" class="btn sm ghost" id="arecrop">${icon('edit')}تعديل القص</button><button type="button" class="btn sm ghost" id="achange">${icon('image')}تغيير الصورة</button></div></div></div>
      <div class="field"><label for="atitle">عنوان قصير (اختياري)</label><input class="inp" id="atitle" maxlength="80" placeholder="مثال: خصم 20% على تبديل البطاريات"></div>
      <div class="field"><span class="lbl">عند الضغط على الإعلان</span><div class="seg" id="alink"><button type="button" class="on" data-v="whatsapp">واتساب</button><button type="button" data-v="call">اتصال</button><button type="button" data-v="none">بدون</button></div></div>
      <div class="field"><span class="lbl">المدة المطلوبة *</span><div class="wrapchips" id="adur">${DURS.map(d => `<button type="button" class="chip out ${d === 30 ? 'on' : ''}" data-v="${d}">${d} يوم</button>`).join('')}</div></div>
      <div class="price-box" id="aprice"></div>
      <div class="field"><label for="anotes">ملاحظات (اختياري)</label><textarea class="inp" id="anotes" maxlength="500" placeholder="أي تفاصيل إضافية للإدارة"></textarea></div>
      <div class="note y">${icon('info')}<div>كل الإعلانات تكون <b>بانتظار الموافقة</b>. الإدارة تتواصل معك لطريقة الدفع، ويبدأ الإعلان بعد تأكيد الدفع.</div></div>
      <button class="btn primary block" type="submit">إرسال طلب الإعلان</button>
      ${session() ? '<a class="btn ghost block" href="#/my-ads">متابعة إعلاناتي</a>' : ''}
    </form>`,
    after: el => bindAdvertise(el),
  };
}
function bindAdvertise(el) {
  const f = $('#adf', el);
  const segPick = id => $$(`#${id} button`, f).forEach(b => b.onclick = () => { $$(`#${id} button`, f).forEach(x => x.classList.remove('on')); b.classList.add('on'); if (id === 'atype') typeChanged(); });
  ['akind', 'alink', 'atype'].forEach(segPick);
  const showPrice = () => {
    const t = $('#atype .on', f).dataset.v, d = +$('#adur .on', f).dataset.v, v = adPrice(t, d);
    $$('#adur .chip', f).forEach(c => { const pv = adPrice(t, +c.dataset.v); c.innerHTML = c.dataset.v + ' يوم' + (pv != null ? ` · <b>${fmtNum(pv)}</b> د.ك` : ''); });
    $('#aprice', f).innerHTML = v != null ? `<span>السعر</span><b>${kwd(v)}</b><small>${d} يوم · الدفع بعد موافقة الإدارة</small>` : '';
  };
  $$('#adur .chip', f).forEach(b => b.onclick = () => { $$('#adur .chip', f).forEach(x => x.classList.remove('on')); b.classList.add('on'); showPrice(); });
  $$('#atype button', f).forEach(b => b.addEventListener('click', showPrice));
  showPrice();
  let adBlob = null, srcFile = null;
  const applyCrop = async file => {
    const blob = await cropImage(file, 1200, 510);
    if (!blob) return;
    adBlob = blob; srcFile = file;
    const pv = $('#aprevimg', f); if (pv.src) URL.revokeObjectURL(pv.src); pv.src = URL.createObjectURL(blob);
    $('#aprev', f).hidden = false; $('#aup', f).hidden = true;
  };
  $('#aimg', f).onchange = e => { const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return; if (file.size > 15 * 1024 * 1024) return toast('حجم الصورة كبير جداً', 'err'); applyCrop(file); };
  $('#arecrop', f).onclick = () => srcFile && applyCrop(srcFile);
  $('#achange', f).onclick = () => $('#aimg', f).click();
  const loadCos = async () => { if (!session()) return; try { const l = (await myCompanies()).filter(c => c.status !== 'rejected'); $('#aco', f).innerHTML = l.length ? l.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('') : '<option value="">لا يوجد نشاط مسجّل</option>'; } catch (_) { } };
  function typeChanged() { const t = $('#atype .on', f).dataset.v; $('#asvcw', f).hidden = t !== 'category_banner'; $('#acow', f).hidden = t !== 'featured'; if (t === 'featured') loadCos(); }
  f.onsubmit = ev => {
    ev.preventDefault();
    const btn = $('button[type=submit]', f);
    busy(btn, async () => {
      const name = $('#aname', f).value.trim(), phone = localPhone($('#aphone', f).value), type = $('#atype .on', f).dataset.v, file = adBlob;
      if (name.length < 2) return toast('اكتب اسم المعلن', 'err');
      if (!phone) return toast('اكتب رقم هاتف صحيح من 8 أرقام', 'err');
      if (!file) return toast('اختر صورة الإعلان', 'err');
      const link = $('#alink .on', f).dataset.v;
      if (link === 'whatsapp' && /^2/.test(phone)) return toast('رقم الواتساب لازم يكون رقم موبايل', 'err');
      if (!(await ensureAuth('لإرسال الإعلان ومتابعة حالته تحتاج حساب (رقم هاتف وكلمة سر فقط).'))) return;
      if (type === 'featured') { await loadCos(); if (!$('#aco', f).value) return toast('سجّل نشاطك أولاً من «انضم الآن»', 'err'); }
      try {
        const ses = session();
        const url = await upload('ads', ses.uid + '/campaign-' + rnd() + '.jpg', adBlob);
        const body = { owner_id: ses.uid, advertiser_name: name, advertiser_kind: $('#akind .on', f).dataset.v, phone, ad_type: type, image_url: url, title: $('#atitle', f).value.trim() || null, link_type: type === 'featured' ? 'company' : link, duration_days: +$('#adur .on', f).dataset.v, notes: $('#anotes', f).value.trim() || null };
        if (type === 'category_banner') body.service_id = $('#asvc', f).value;
        if (type === 'featured') body.company_id = +$('#aco', f).value;
        await rest('ad_campaigns', { method: 'POST', body, prefer: 'return=minimal' });
        $('#view').innerHTML = `${topbar('أعلن معنا')}<div class="success"><div class="ok">${icon('check')}</div><h2>تم إرسال طلب الإعلان</h2><p>حالة إعلانك الآن: <b>بانتظار الموافقة</b>. الإدارة بتراجعه وتتواصل معك على ${esc(phone)} لتأكيد السعر والدفع.</p><a class="btn dark block" href="#/my-ads">متابعة إعلاناتي</a><a class="btn ghost block" href="#/">الرئيسية</a></div>`;
      } catch (err) { toast(errText(err), 'err'); }
    }, 'جاري الإرسال...');
  };
}
const adStatus = a => {
  const now = Date.now(), st = a.starts_at && Date.parse(a.starts_at), en = a.ends_at && Date.parse(a.ends_at);
  if (a.status === 'pending') return ['warn', 'بانتظار الموافقة'];
  if (a.status === 'rejected') return ['bad', 'مرفوض'];
  if (a.status === 'paused') return ['warn', 'موقوف مؤقتاً'];
  if (a.status === 'ended' || (en && en <= now)) return ['', 'منتهي'];
  if (a.payment_status !== 'paid') return ['warn', 'مقبول — بانتظار تأكيد الدفع'];
  if (st && st > now) return ['', 'مجدول يبدأ ' + fmtDate(a.starts_at)];
  return ['ok', 'منشور حتى ' + fmtDate(a.ends_at)];
};
async function pgMyAds() {
  if (!session()) return { html: topbar('إعلاناتي') + emptyBox('megaphone', 'سجّل دخولك', 'لمتابعة إعلاناتك.', '<a class="btn primary" href="#/auth?next=/my-ads">دخول</a>') };
  let list = [];
  try { list = await rest('ad_campaigns?select=id,advertiser_name,ad_type,image_url,title,duration_days,status,payment_status,starts_at,ends_at,reject_reason,views,clicks,created_at&order=created_at.desc') || []; }
  catch (e) { return { html: topbar('إعلاناتي') + emptyBox('refresh', 'تعذّر التحميل', errText(e)) }; }
  const tName = id => (AD_TYPES.find(t => t.id === id) || {}).t || id;
  return {
    tab: 'req',
    html: topbar('إعلاناتي') + (list.length ? `<div class="stack" style="margin-top:12px">${list.map(a => { const [k, t] = adStatus(a); return `<div class="item-card"><img class="wide-img" src="${esc(safeImg(a.image_url))}" alt="" loading="lazy">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${esc(a.title || tName(a.ad_type))}</b><span class="tg ${k}">${esc(t)}</span></div>
      <small style="color:var(--mut)">${esc(tName(a.ad_type))} · ${a.duration_days} يوم · أُرسل ${fmtDate(a.created_at)}</small>
      ${a.reject_reason ? `<div class="note bad">${icon('info')}<div>${esc(a.reject_reason)}</div></div>` : ''}
      ${a.status === 'approved' ? `<div class="stats3"><div><b>${fmtNum(a.views)}</b><small>مشاهدة</small></div><div><b>${fmtNum(a.clicks)}</b><small>نقرة</small></div><div><b>${a.views ? ((a.clicks / a.views) * 100).toFixed(1) + '%' : '—'}</b><small>نسبة النقر</small></div></div>` : ''}
      ${a.status === 'pending' && a.payment_status === 'unpaid' ? `<button class="btn sm danger-soft" data-act="del-ad" data-id="${a.id}">${icon('trash')}إلغاء الطلب</button>` : ''}</div>`; }).join('')}<a class="btn primary block" href="#/advertise">${icon('plus')}طلب إعلان جديد</a></div>`
        : emptyBox('megaphone', 'ما عندك إعلانات', 'قدّم طلب إعلانك وتابع حالته وإحصائياته من هنا.', '<a class="btn primary" href="#/advertise">أعلن معنا</a>')),
  };
}
async function pgRequests(_, q) {
  const t = q.get('t') === 'biz' ? 'biz' : 'ads';
  const inner = await (t === 'ads' ? pgMyAds() : pgMyBusiness());
  const body = (inner.html || '').replace(/^\s*<header[\s\S]*?<\/header>/, '');
  return {
    tab: 'req',
    html: `<header class="topbar"><h1 style="font-size:24px">طلباتي</h1></header>
      <div class="seg req-seg"><a href="#/requests?t=ads" class="${t === 'ads' ? 'on' : ''}" style="flex:1;height:44px;border-radius:11px;display:grid;place-items:center;font-weight:800;${t === 'ads' ? 'background:var(--surface);color:var(--brand);box-shadow:var(--sh-1)' : 'color:var(--mut)'}">إعلاناتي</a><a href="#/requests?t=biz" style="flex:1;height:44px;border-radius:11px;display:grid;place-items:center;font-weight:800;${t === 'biz' ? 'background:var(--surface);color:var(--brand);box-shadow:var(--sh-1)' : 'color:var(--mut)'}">طلب الانضمام</a></div>
      ${body}`,
  };
}
function pgAbout() {
  return {
    tab: 'account',
    html: `${topbar('عن ماتعطل')}<div class="pad" style="display:grid;gap:14px;margin-top:12px;line-height:1.9;font-size:15px;color:var(--ink2)">
      <div class="logo" style="font-size:30px"><span class="mark">م</span>ماتعطل</div>
      <p style="margin:0">ماتعطل منصة كويتية تجمع مقدمي خدمات السيارات: الونشات وسحب السيارات، البنشر المتنقل، مفاتيح وبرمجة السيارات، الغسيل المتنقل، الحماية والتظليل، البطاريات وغيرها.</p>
      <div class="kv"><div class="r">${icon('shieldc')}<span><b>مقدمو الخدمة</b><div>لا يظهر أي مقدم خدمة للعامة إلا بعد موافقة الإدارة واشتراك فعّال.</div></span></div>
      <div class="r">${icon('megaphone')}<span><b>الإعلانات</b><div>لا يظهر أي إعلان إلا بعد موافقة الإدارة وتأكيد الدفع، ويتوقف تلقائياً بانتهاء مدته.</div></span></div>
      <div class="r">${icon('lock')}<span><b>الخصوصية</b><div>التصفح بدون حساب. لا نخزّن بيانات حساسة على جهازك غير جلسة الدخول. موقعك يُحفظ على جهازك فقط ويُرسل لمقدم الخدمة فقط عند ضغطك على واتساب.</div></span></div>
      <div class="r">${icon('phone')}<span><b>أرقام الهواتف</b><div>التسجيل برقم الهاتف بدون رسائل تحقق، لذلك الرقم لا يُعتبر إثباتاً لملكيته.</div></span></div></div>
      <a class="btn wa block" target="_blank" rel="noopener" href="${waHref(supportWa(), 'السلام عليكم')}">${icon('wa')}تواصل مع ماتعطل</a>
      <div class="footer-note">mat3tl.com · الإصدار ${VERSION}</div></div>`,
  };
}

/* ================= المنطقة والموقع ================= */
function areaSheet(scope) {
  const cur = scope === 'list' ? (new URLSearchParams(location.hash.split('?')[1] || '').get('area') || S.area) : S.area;
  sheet(`<div class="sheet-h"><h3>اختر المنطقة</h3><button class="icon-btn clear" data-close>${icon('close')}</button></div>
    <div class="sheet-body"><div class="row2"><button class="btn dark" data-act="locate">${icon('locate')}موقعي الحالي</button><button class="btn ghost" data-act="mappick">${icon('map')}على الخريطة</button></div>
    <div class="area-list"><button class="${cur === 'all' ? 'on' : ''}" data-act="set-area" data-v="all" data-scope="${scope || ''}">كل الكويت</button>${S.areas.map(a => `<button class="${cur === a ? 'on' : ''}" data-act="set-area" data-v="${esc(a)}" data-scope="${scope || ''}">${esc(a)}</button>`).join('')}</div>
    ${S.pos ? `<button class="btn line block" data-act="clear-pos">${icon('close')}مسح موقعي المحفوظ</button>` : ''}</div>`);
}
function setArea(a, scope) {
  closeSheet();
  if (scope === 'list') { const [p, qs] = location.hash.slice(1).split('?'); const q = new URLSearchParams(qs || ''); a === 'all' ? q.set('area', 'all') : q.set('area', a); go(p + '?' + q.toString(), true); return; }
  S.area = a; store.set('area', a); render(true);
}
function setPos(p, quiet) {
  S.pos = p; store.set('pos', p);
  const a = nearestArea(p, S.areas.length ? S.areas : Object.keys({}));
  if (a) { S.area = a; store.set('area', a); }
  closeSheet(); render(true);
  if (!quiet) toast(a ? 'تم تحديد موقعك · ' + a : 'تم تحديد موقعك', 'ok');
}

/* ================= التوجيه ================= */
const ROUTES = [
  [/^\/?$/, pgHome], [/^\/categories$/, pgCategories], [/^\/s\/([\w-]+)$/, pgService], [/^\/search$/, pgSearch], [/^\/c\/(\d+)$/, pgCompany],
  [/^\/advertise$/, pgAdvertise], [/^\/join$/, pgJoin], [/^\/account$/, pgAccount], [/^\/auth$/, pgAuth], [/^\/favorites$/, pgFavorites],
  [/^\/my-ads$/, pgMyAds], [/^\/requests$/, pgRequests], [/^\/my-business$/, pgMyBusiness], [/^\/notifications$/, pgNotifications], [/^\/about$/, pgAbout],
];
const parse = () => { const h = location.hash.replace(/^#/, '') || '/'; const [p, qs] = h.split('?'); return { p: p || '/', q: new URLSearchParams(qs || '') }; };
export function go(path, replace) { const h = '#' + (path.startsWith('/') ? path : '/' + path); if (replace) { history.replaceState(null, '', h); render(); } else location.hash = h; }
const navStack = []; const scrollMem = {};
let renderSeq = 0;
async function render(soft) {
  const seq = ++renderSeq;
  const { p, q } = parse();
  const key = location.hash || '#/';
  let fn = pgHome, m = [];
  for (const [re, f] of ROUTES) { const x = p.match(re); if (x) { fn = f; m = x.slice(1); break; } }
  if (!ROUTES.some(([re]) => re.test(p))) { fn = () => ({ html: topbar('الصفحة غير موجودة') + emptyBox('info', 'الصفحة غير موجودة', '', '<a class="btn primary" href="#/">الرئيسية</a>') }); }
  const res = await fn(m, q);
  if (seq !== renderSeq) return;
  const view = $('#view');
  const y = soft ? scrollY : null;
  if (!soft) { view.style.animation = 'none'; void view.offsetWidth; view.style.animation = ''; }
  view.innerHTML = res.html || '';
  document.body.classList.toggle('hide-tabs', !!res.hideTabs);
  $$('.tabbar [data-tab]').forEach(a => a.classList.toggle('on', a.dataset.tab === res.tab));
  if (res.after) try { await res.after(view); } catch (e) { console.error(e); }
  if (soft) scrollTo(0, y);
  else if (scrollMem[key] != null && navStack[navStack.length - 1] === key) scrollTo(0, scrollMem[key]);
  else scrollTo(0, 0);
  const t = { '/': 'ماتعطل | خدمات السيارات بالكويت' }[p];
  document.title = t || (($('.topbar h1', view) || {}).textContent ? $('.topbar h1', view).textContent + ' | ماتعطل' : 'ماتعطل');
}
let lastKey = location.hash || '#/';
addEventListener('hashchange', () => {
  scrollMem[lastKey] = scrollY;
  const key = location.hash || '#/';
  if (navStack[navStack.length - 2] === key) navStack.pop(); else navStack.push(lastKey);
  lastKey = key;
  closeSheet(true); render();
});

/* ================= الأحداث ================= */
const ACT = {
  back: () => { if (navStack.length) history.back(); else go('/'); },
  reload: () => loadPublic(true),
  fav: el => toggleFav(el.dataset.id, el),
  area: el => areaSheet(el.dataset.scope),
  'set-area': el => setArea(el.dataset.v, el.dataset.scope),
  locate: el => busy(el, () => geo().then(p => setPos(p)).catch(() => toast('ما قدرنا نحدد موقعك. فعّل الموقع أو اختر منطقتك يدوياً.', 'err')), 'جاري التحديد...'),
  mappick: async () => { closeSheet(true); const p = await pickOnMap(S.pos); if (p) setPos(p); },
  'clear-pos': () => { S.pos = null; store.del('pos'); closeSheet(); render(true); toast('تم مسح الموقع'); },
  sort: el => {
    const cur = el.dataset.cur;
    sheet(`<div class="sheet-h"><h3>الترتيب</h3><button class="icon-btn clear" data-close>${icon('close')}</button></div><div class="sheet-body"><div class="opt-grid">${Object.entries(SORTS).map(([k, t]) => `<button class="opt ${k === cur ? 'on' : ''}" data-act="set-sort" data-v="${k}"><span class="ic">${icon(k === 'near' ? 'locate' : k === 'rating' ? 'star' : 'clock')}</span><span><b>${t}</b>${k === 'near' && !S.pos ? '<small>يحتاج تحديد موقعك</small>' : ''}</span><span class="rad"></span></button>`).join('')}</div></div>`);
  },
  'set-sort': async el => {
    const v = el.dataset.v; closeSheet(true);
    if (v === 'near' && !S.pos) { try { const p = await geo(); S.pos = p; store.set('pos', p); } catch (_) { toast('فعّل الموقع لترتيب الأقرب', 'err'); return; } }
    const [p, qs] = location.hash.slice(1).split('?'); const q = new URLSearchParams(qs || ''); q.set('sort', v); go(p + '?' + q.toString(), true);
  },
  share: async el => {
    const c = coById(el.dataset.id); if (!c) return;
    const url = location.origin + location.pathname + '#/c/' + c.id, text = c.name + ' — ' + svcName(c.s) + ' | ماتعطل';
    if (navigator.share) { try { await navigator.share({ title: c.name, text, url }); } catch (_) { } }
    else { try { await navigator.clipboard.writeText(url); toast('تم نسخ الرابط'); } catch (_) { toast(url); } }
  },
  photo: el => { const c = coById(el.dataset.id); if (!c) return; sheet(`<div class="sheet-body"><img src="${esc(c.photos[+el.dataset.i])}" alt="" style="border-radius:16px;width:100%"><button class="btn ghost block" data-close>إغلاق</button></div>`); },
  review: el => reviewSheet(el.dataset.id),
  showpw: el => { const i = el.parentElement.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; },
  forgot: () => forgotSheet(),
  logout: async () => { if (await confirmBox('تأكيد تسجيل الخروج؟', { ok: 'خروج' })) { await logout(); S.profile = null; S.isAdmin = false; toast('تم تسجيل الخروج'); go('/account', true); } },
  'delete-account': async () => {
    if (!(await confirmBox('سيتم حذف حسابك نهائياً مع المفضلة والإشعارات. الأنشطة والإعلانات المرتبطة قد تُحذف. متأكد؟', { ok: 'حذف نهائي', danger: true }))) return;
    try { await rpc('delete_my_account'); await logout(); toast('تم حذف الحساب'); go('/', true); } catch (e) { toast(errText(e), 'err'); }
  },
  'edit-name': () => {
    sheet(`<div class="sheet-h"><h3>تعديل الاسم</h3><button class="icon-btn clear" data-close>${icon('close')}</button></div><div class="sheet-body"><input class="inp" id="nn" maxlength="80" value="${esc((S.profile && S.profile.full_name) || '')}"><button class="btn primary block" id="nns">حفظ</button></div>`, {
      onOpen: sh => $('#nns', sh).onclick = e => busy(e.currentTarget, async () => { try { await rest('profiles?id=eq.' + session().uid, { method: 'PATCH', body: { full_name: $('#nn', sh).value.trim() || null }, prefer: 'return=minimal' }); await loadMe(); closeSheet(); render(true); toast('تم الحفظ', 'ok'); } catch (err) { toast(errText(err), 'err'); } })
    });
  },
  recovery: async () => {
    let has = false; try { has = await rpc('has_recovery_code'); } catch (_) { }
    sheet(`<div class="sheet-h"><h3>رمز الاسترجاع</h3><button class="icon-btn clear" data-close>${icon('close')}</button></div><div class="sheet-body">
      <div class="note">${icon('key2')}<div>بما إننا ما نرسل رسائل SMS، رمز الاسترجاع هو طريقتك لتغيير كلمة السر إذا نسيتها. احفظه في مكان آمن — يظهر مرة وحدة فقط.</div></div>
      ${has ? '<div class="note ok">' + icon('check') + '<div>عندك رمز محفوظ. إنشاء رمز جديد يلغي القديم.</div></div>' : ''}
      <div id="rcout"></div><button class="btn primary block" id="rcgo">${has ? 'إنشاء رمز جديد' : 'إنشاء رمز'}</button></div>`, {
      onOpen: sh => $('#rcgo', sh).onclick = e => busy(e.currentTarget, async () => {
        try { const code = await rpc('create_recovery_code'); $('#rcout', sh).innerHTML = `<div class="kv"><div class="r"><span style="flex:1"><b>رمزك (انسخه الآن)</b><div dir="ltr" style="font-size:20px;font-weight:800;letter-spacing:1px;text-align:center;user-select:all">${esc(code)}</div></span></div></div>`; e.currentTarget && (e.currentTarget.hidden = true); try { await navigator.clipboard.writeText(code); toast('تم نسخ الرمز'); } catch (_) { } }
        catch (err) { toast(errText(err), 'err'); }
      })
    });
  },
  'change-pw': () => {
    sheet(`<div class="sheet-h"><h3>تغيير كلمة السر</h3><button class="icon-btn clear" data-close>${icon('close')}</button></div><div class="sheet-body">
      <div class="field"><label>كلمة السر الجديدة</label><input class="inp" id="np1" type="password" autocomplete="new-password" maxlength="72" placeholder="8 خانات أو أكثر (أرقام وحروف)"></div>
      <div class="field"><label>تأكيد كلمة السر</label><input class="inp" id="np2" type="password" autocomplete="new-password" maxlength="72"></div>
      <button class="btn primary block" id="npgo">حفظ</button></div>`, {
      onOpen: sh => $('#npgo', sh).onclick = e => busy(e.currentTarget, async () => {
        const a = $('#np1', sh).value, b = $('#np2', sh).value;
        if (a.length < 8 || !/\d/.test(a) || !/\D/.test(a)) return toast(errText('weak password'), 'err');
        if (a !== b) return toast('كلمتا السر غير متطابقتين', 'err');
        try { await api('/auth/v1/user', { method: 'PUT', body: { password: a } }); closeSheet(); toast('تم تغيير كلمة السر', 'ok'); } catch (err) { toast(errText(err), 'err'); }
      })
    });
  },
  'del-ad': async el => { if (!(await confirmBox('إلغاء طلب الإعلان؟', { ok: 'إلغاء الطلب', danger: true }))) return; try { await rest('ad_campaigns?id=eq.' + (+el.dataset.id), { method: 'DELETE' }); toast('تم إلغاء الطلب'); render(true); } catch (e) { toast(errText(e), 'err'); } },
  'clear-recent': () => { S.recent = []; store.set('recent', []); render(true); },
  install: () => installApp(),
  'install-hide': () => { store.set('installDismiss', 1); render(true); },
  'copy-link': async () => { try { await navigator.clipboard.writeText(location.origin + location.pathname); toast('تم نسخ الرابط — افتحه في Safari', 'ok'); } catch (_) { toast(location.origin); } },
  theme: () => { const order = ['auto', 'light', 'dark']; const cur = store.get('theme', 'auto'); const n = order[(order.indexOf(cur) + 1) % 3]; store.set('theme', n); applyTheme(); render(true); },
  goreg: (el, e) => { e.preventDefault(); go('/auth'); setTimeout(() => { const b = $('.seg button[data-mode="register"]'); b && b.click(); }, 50); },
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (a) { const f = ACT[a.dataset.act]; if (f) { if (a.tagName === 'A' && a.dataset.act !== 'goreg') e.preventDefault(); f(a, e); return; } }
  const t = e.target.closest('[data-track]');
  if (t) { track(t.dataset.track, t.dataset.id); return; }
  const ad = e.target.closest('[data-ad]');
  if (ad) trackAd(ad.dataset.ad, 'click');
  const card = e.target.closest('[data-href]');
  if (card && !e.target.closest('a,button')) location.hash = card.dataset.href;
});
document.addEventListener('keydown', e => { if (e.key === 'Enter') { const c = e.target.closest && e.target.closest('[data-href]'); if (c && e.target === c) location.hash = c.dataset.href; } if (e.key === 'Escape') closeSheet(); });
let liveT = null;
document.addEventListener('input', e => {
  const el = e.target; if (!el.dataset || !el.dataset.live) return;
  clearTimeout(liveT);
  liveT = setTimeout(() => {
    const v = el.value.trim();
    if (el.dataset.live === 'search') {
      history.replaceState(null, '', '#/search' + (v ? '?q=' + encodeURIComponent(v) : '')); lastKey = location.hash;
      $('#sres').innerHTML = searchResults(v);
      if (v.length >= 2) { S.recent = [v, ...S.recent.filter(x => x !== v)].slice(0, 8); store.set('recent', S.recent); track('search'); }
    } else if (el.dataset.live === 'svcq') {
      const [p, qs] = location.hash.slice(1).split('?'); const q = new URLSearchParams(qs || ''); v ? q.set('q', v) : q.delete('q');
      history.replaceState(null, '', '#' + p + (q.toString() ? '?' + q : '')); lastKey = location.hash;
      const pos = el.selectionStart; render(true).then(() => { const i = $('[data-live="svcq"]'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (_) { } } });
    }
  }, el.dataset.live === 'search' ? 220 : 280);
});

/* ================= PWA ================= */
addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; });
async function installApp() {
  // أندرويد/كروم/إيدج: تثبيت مباشر بضغطة واحدة
  if (S.installEvt) {
    const ev = S.installEvt; S.installEvt = null;
    ev.prompt(); let ok = false; try { ok = (await ev.userChoice).outcome === 'accepted'; } catch (_) { }
    if (ok) { store.set('installDismiss', 1); toast('تم تحميل ماتعطل على شاشتك الرئيسية', 'ok'); render(true); }
    return;
  }
  const ua = navigator.userAgent, ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const iosOther = ios && /CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram|Snapchat/i.test(ua);
  const head = `<div class="inst-head"><img src="icons/icon-192.png" alt="" width="72" height="72"><div><b>ماتعطل</b><small>mat3tl.com</small></div></div>`;
  let body;
  if (iosOther) body = `<div class="note y">${icon('info')}<div>على الآيفون التحميل يشتغل من <b>Safari</b> فقط. انسخ الرابط وافتحه في Safari.</div></div>
    <button class="btn primary block" data-act="copy-link">${icon('share')}نسخ الرابط</button>`;
  else if (ios) body = `<div class="inst-steps">
      <div class="st"><span class="n">1</span><span class="tx">اضغط زر <b>المشاركة</b> أسفل الشاشة</span><span class="vis">${icon('share')}</span></div>
      <div class="st"><span class="n">2</span><span class="tx">اختر <b>«إضافة إلى الشاشة الرئيسية»</b></span><span class="vis">${icon('plus')}</span></div>
      <div class="st"><span class="n">3</span><span class="tx">اضغط <b>«إضافة»</b> — تظهر أيقونة ماتعطل على شاشتك</span><span class="vis app"><img src="icons/icon-96.png" alt=""></span></div></div>
    <div class="inst-arrow">${icon('chevD')}زر المشاركة تحت ${icon('chevD')}</div>`;
  else body = `<div class="inst-steps">
      <div class="st"><span class="n">1</span><span class="tx">افتح قائمة المتصفح <b>⋮</b> فوق</span><span class="vis">⋮</span></div>
      <div class="st"><span class="n">2</span><span class="tx">اختر <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b></span><span class="vis app"><img src="icons/icon-96.png" alt=""></span></div></div>`;
  sheet(`<div class="sheet-h"><h3>تحميل تطبيق ماتعطل</h3><button class="icon-btn clear" data-close>${icon('close')}</button></div><div class="sheet-body">${head}${body}<button class="btn ghost block" data-close>تم</button></div>`);
}
function applyTheme() { const t = store.get('theme', 'auto'); t === 'auto' ? document.documentElement.removeAttribute('data-theme') : document.documentElement.setAttribute('data-theme', t); }
applyTheme();
if ('serviceWorker' in navigator && location.protocol === 'https:') addEventListener('load', () => navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => { }));
const offline = () => { let b = $('#offbar'); if (!navigator.onLine) { if (!b) { b = document.createElement('div'); b.id = 'offbar'; b.className = 'offline-bar'; b.textContent = 'أنت غير متصل — تعرض آخر بيانات محفوظة'; $('#app').prepend(b); } } else if (b) { b.remove(); loadPublic(true); } };
addEventListener('online', offline); addEventListener('offline', offline);
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadPublic(); });

/* ================= البدء ================= */
(async function boot() {
  render();
  const sp = $('#splash'); const hide = () => sp && sp.classList.add('out');
  setTimeout(hide, store.get('pub') ? 250 : 1600);
  await Promise.all([loadPublic(true), loadMe()]);
  render(true); hide(); offline();
  track('visit');
  if (S.area === 'all' && !S.pos && !store.get('askedGeo') && navigator.permissions) {
    try { const st = await navigator.permissions.query({ name: 'geolocation' }); if (st.state === 'granted') geo().then(p => setPos(p, true)).catch(() => { }); } catch (_) { }
  }
})();
