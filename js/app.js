// ماتعطل v5 — تطبيق السوق (واجهة العملاء)
import { t, nm, lang, setLang, isAr, errText } from './i18n.js?v=502';
import {
  CFG, esc, $, $$, digits, localPhone, rnd, safeImg, fmtNum, fmtDate, ago, store, initSession, session, onAuth,
  rest, rpc, login, register, logout, myProfile, shrinkImage, upload, removeImages, icon, CAT_ICONS, toast, sheet, closeSheet,
  confirmBox, promptBox, busy,
} from './core.js?v=502';

const PAGE = 20;
const GOVS = ['capital', 'hawalli', 'farwaniya', 'jahra', 'ahmadi', 'mubarak'];
const AD_COLS = 'id,title,price,price_type,images,area_id,category_id,status,featured_until,created_at,bumped_at';
const S = { cats: [], cat: {}, areas: [], area: {}, settings: {}, me: null, favs: new Set(), ready: false };
const view = () => $('#view');

/* ================= البيانات العامة ================= */
function applyPublic(d) {
  S.cats = (d.cats || []).filter(c => c.is_active !== false).sort((a, b) => a.sort - b.sort);
  S.cat = Object.fromEntries(S.cats.map(c => [c.id, c]));
  S.areas = (d.areas || []).filter(a => a.is_active !== false).sort((a, b) => GOVS.indexOf(a.gov) - GOVS.indexOf(b.gov) || a.sort - b.sort);
  S.area = Object.fromEntries(S.areas.map(a => [a.id, a]));
  S.settings = Object.fromEntries((d.settings || []).map(s => [s.key, s.value]));
  if (S.settings.support_whatsapp) CFG.supportWa = String(S.settings.support_whatsapp);
}
async function loadPublic() {
  const cached = store.get('pub');
  if (cached) { applyPublic(cached); S.ready = true; }
  const p = Promise.all([
    rest('market_categories?select=id,name_ar,name_en,icon,sort,is_active,price_label,fields&order=sort.asc', { anon: true }),
    rest('kw_areas?select=id,gov,name_ar,name_en,sort,is_active&order=sort.asc', { anon: true }),
    rest('app_settings?select=key,value&is_public=eq.true', { anon: true }).catch(() => []),
  ]).then(([cats, areas, settings]) => { const d = { cats, areas, settings }; store.set('pub', d); applyPublic(d); S.ready = true; });
  if (!cached) await p; else p.catch(() => { });
}
const market = () => Object.assign({ max_images: 10, require_approval: false }, S.settings.market || {});
const paid = () => Object.assign({ enabled: false, featured_prices: {} }, S.settings.paid_ads || {});

async function loadMe() {
  if (!session()) { S.me = null; return null; }
  try { S.me = await myProfile(); } catch (e) { if (e.status === 401) await logout(); S.me = null; }
  return S.me;
}
const isStaff = () => S.me && (S.me.role === 'admin' || S.me.role === 'staff');

/* ================= المفضلة ================= */
function localFavs() { return new Set((store.get('favs', []) || []).map(Number).filter(Boolean)); }
async function syncFavs() {
  if (!session()) { S.favs = localFavs(); return; }
  try {
    const loc = localFavs();
    const r = await rest('market_favorites?select=ad_id&order=created_at.desc&limit=500') || [];
    S.favs = new Set(r.map(x => +x.ad_id));
    const add = [...loc].filter(id => !S.favs.has(id));
    if (add.length) {
      await rest('market_favorites', { method: 'POST', body: add.map(id => ({ ad_id: id })), prefer: 'resolution=ignore-duplicates,return=minimal' }).catch(() => { });
      add.forEach(id => S.favs.add(id));
    }
    store.del('favs');
  } catch (_) { }
}
async function toggleFav(id, btn) {
  id = +id; const on = !S.favs.has(id);
  on ? S.favs.add(id) : S.favs.delete(id);
  $$(`[data-fav="${id}"]`).forEach(b => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  toast(t(on ? 'fav_add' : 'fav_del'));
  if (!session()) { store.set('favs', [...S.favs]); return; }
  try {
    if (on) await rest('market_favorites', { method: 'POST', body: { ad_id: id }, prefer: 'resolution=ignore-duplicates,return=minimal' });
    else await rest('market_favorites?ad_id=eq.' + id, { method: 'DELETE' });
  } catch (e) { on ? S.favs.delete(id) : S.favs.add(id); $$(`[data-fav="${id}"]`).forEach(b => b.classList.toggle('on', !on)); toast(errText(e), 'err'); }
}

/* ================= العدادات ================= */
const tracked = new Set();
function track(kind, ad) { const k = kind + ':' + (ad || ''); if (kind !== 'm_search' && tracked.has(k)) return; tracked.add(k); rpc('track_market', { p_kind: kind, p_ad: ad ? +ad : null }, { anon: true }).catch(() => { }); }

/* ================= تنسيق ================= */
const catIcon = c => icon(c && CAT_ICONS.includes(c.icon) ? c.icon : 'box');
const govName = g => t('gov_' + g);
const areaName = id => { const a = S.area[id]; return a ? nm(a) : ''; };
const areaFull = id => { const a = S.area[id]; return a ? nm(a) + (isAr() ? '، ' : ', ') + govName(a.gov) : ''; };
function priceHtml(a, big) {
  if (a.price_type === 'free') return `<span class="pr free">${t('free')}</span>`;
  if (a.price_type === 'ask' || a.price == null) return `<span class="pr ask">${t('ask')}</span>`;
  return `<span class="pr">${fmtNum(a.price)} <small>${t('kwd')}</small>${a.price_type === 'negotiable' && big ? ` <em class="neg">${t('negotiable')}</em>` : ''}</span>`;
}
const isFeatured = a => a.featured_until && new Date(a.featured_until) > new Date();
function optLabel(f, v) { const o = (f.o || []).find(x => x.v === v); return o ? nm(o) : v; }
function specsList(a) {
  const c = S.cat[a.category_id]; if (!c) return [];
  return (c.fields || []).map(f => {
    const v = a.specs && a.specs[f.k]; if (v == null || v === '') return null;
    return [nm(f), f.t === 'select' ? optLabel(f, v) : f.t === 'number' ? (f.k === 'year' ? String(v) : fmtNum(v)) : String(v)];
  }).filter(Boolean);
}
const waLink = (phone, text) => 'https://wa.me/965' + phone + '?text=' + encodeURIComponent(text);
const adUrl = id => location.origin + location.pathname.replace(/[^/]*$/, '') + '#/ad/' + id;

function topbar(title, { back = true, actions = '' } = {}) {
  return `<header class="topbar">${back ? `<button class="icon-btn" data-act="back" aria-label="${t('back')}">${icon(isAr() ? 'chevR' : 'chevL')}</button>` : '<span class="sp"></span>'}<h1>${esc(title)}</h1><div class="tb-act">${actions}</div></header>`;
}
const emptyBox = (ic, title, sub = '', extra = '') => `<div class="empty"><div class="em-i">${icon(ic)}</div><b>${esc(title)}</b>${sub ? `<p>${esc(sub)}</p>` : ''}${extra}</div>`;
const skeleton = n => Array.from({ length: n }, () => '<div class="card sk"><div class="ph"></div><div class="bd"><i></i><i></i><i></i></div></div>').join('');

function card(a) {
  const img = safeImg(a.images && a.images[0]); const c = S.cat[a.category_id];
  const n = (a.images || []).length;
  return `<a class="card${a.status === 'sold' ? ' is-sold' : ''}" href="#/ad/${a.id}">
    <div class="ph">${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">` : `<span class="noimg">${catIcon(c)}</span>`}
      ${a.status === 'sold' ? `<span class="badge sold">${t('sold')}</span>` : isFeatured(a) ? `<span class="badge feat">${icon('star')}${t('featured').split(' ')[0]}</span>` : ''}
      ${n > 1 ? `<span class="cnt">${icon('camera')}${n}</span>` : ''}</div>
    <div class="bd"><h3>${esc(a.title)}</h3>${priceHtml(a)}
      <div class="mt"><span>${icon('pin')}${esc(areaName(a.area_id))}</span><span>${icon('clock')}${esc(ago(a.bumped_at || a.created_at))}</span></div></div>
    <button class="fav${S.favs.has(+a.id) ? ' on' : ''}" data-fav="${a.id}" aria-label="${t('favs')}" aria-pressed="${S.favs.has(+a.id)}">${icon('heart')}</button></a>`;
}
const featCard = a => { const img = safeImg(a.images && a.images[0]); return `<a class="fcard" href="#/ad/${a.id}"><div class="ph">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="noimg">${catIcon(S.cat[a.category_id])}</span>`}<span class="badge feat">${icon('star')}</span></div><b>${esc(a.title)}</b>${priceHtml(a)}</a>`; };

/* ================= الاستعلام والفلاتر ================= */
function parseF(q) {
  const f = { cat: q.get('cat') || '', q: q.get('q') || '', area: q.get('area') || '', min: q.get('min') || '', max: q.get('max') || '', photos: q.get('photos') === '1', sort: q.get('sort') || 'new', specs: {} };
  for (const [k, v] of q) if (k.startsWith('s_') && v) f.specs[k.slice(2)] = v;
  return f;
}
function fToQuery(f, withCat) {
  const p = new URLSearchParams();
  if (withCat && f.cat) p.set('cat', f.cat);
  if (f.q) p.set('q', f.q); if (f.area) p.set('area', f.area); if (f.min) p.set('min', f.min); if (f.max) p.set('max', f.max);
  if (f.photos) p.set('photos', '1'); if (f.sort && f.sort !== 'new') p.set('sort', f.sort);
  for (const k in f.specs) if (f.specs[k]) p.set('s_' + k, f.specs[k]);
  const s = p.toString(); return s ? '?' + s : '';
}
function feedQS(f, offset = 0, extra = '') {
  const p = [`select=${AD_COLS}`, 'status=eq.active'];
  if (f.cat) p.push('category_id=eq.' + encodeURIComponent(f.cat));
  if (f.area) {
    if (f.area.startsWith('gov:')) { const ids = S.areas.filter(a => a.gov === f.area.slice(4)).map(a => a.id); if (ids.length) p.push('area_id=in.(' + ids.join(',') + ')'); }
    else if (+f.area) p.push('area_id=eq.' + (+f.area));
  }
  const mn = parseFloat(digits(f.min)), mx = parseFloat(digits(f.max));
  if (f.min !== '' && isFinite(mn)) p.push('price=gte.' + mn);
  if (f.max !== '' && isFinite(mx)) p.push('price=lte.' + mx);
  if (f.photos) p.push('images=neq.{}');
  for (const k in f.specs) if (/^[a-z0-9_]{1,30}$/.test(k) && f.specs[k]) p.push(`specs->>${k}=eq.` + encodeURIComponent(f.specs[k]));
  const q = String(f.q || '').replace(/[,()*\\:"'.%]/g, ' ').trim().slice(0, 60);
  if (q) { const w = encodeURIComponent('*' + q.split(/\s+/).join('*') + '*'); p.push(`or=(title.ilike.${w},description.ilike.${w})`); }
  p.push('order=' + (f.sort === 'low' ? 'price.asc.nullslast,bumped_at.desc' : f.sort === 'high' ? 'price.desc.nullslast,bumped_at.desc' : 'bumped_at.desc'));
  p.push('limit=' + PAGE, 'offset=' + offset);
  return 'market_ads?' + p.join('&') + extra;
}
/** يعرض قائمة إعلانات مع «عرض المزيد» */
function mountFeed(box, f, { countEl } = {}) {
  let off = 0, done = false, loading = false;
  const list = $('.feed', box), more = $('.more', box);
  const load = async () => {
    if (loading || done) return; loading = true;
    if (!off) list.innerHTML = skeleton(6);
    more.hidden = true;
    try {
      const r = await rest(feedQS(f, off), { anon: true, count: !off && !!countEl });
      const rows = Array.isArray(r) ? r : r.rows;
      if (!off) { list.innerHTML = ''; if (countEl && r.total != null) countEl.textContent = t('ads_n', { n: fmtNum(r.total) }); }
      if (!off && !rows.length) list.innerHTML = emptyBox('search', t('no_ads'), t('no_ads_sub'), `<a class="btn primary sm" href="#/post${f.cat ? '?cat=' + f.cat : ''}">${icon('plus')}${t('post')}</a>`);
      list.insertAdjacentHTML('beforeend', rows.map(card).join(''));
      off += rows.length; done = rows.length < PAGE; more.hidden = done;
    } catch (e) {
      if (!off) list.innerHTML = emptyBox('refresh', t('error'), errText(e), `<button class="btn ghost sm" data-retry>${t('retry')}</button>`);
      else { more.hidden = false; toast(errText(e), 'err'); }
      const rb = $('[data-retry]', list); if (rb) rb.onclick = () => { loading = false; load(); };
    } finally { loading = false; }
  };
  more.onclick = load;
  // تحميل تلقائي عند الوصول لنهاية القائمة
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es[0].isIntersecting && off && !done) load(); }, { rootMargin: '400px' }); io.observe(more); box._io = io; }
  load();
}
const feedBox = () => `<div class="feedwrap"><div class="feed"></div><button class="btn ghost block more" hidden>${t('load_more')}</button></div>`;

function areaSelect(name, val, { all = true, gov = true, req = false } = {}) {
  let h = `<select class="inp" name="${name}" ${req ? 'required' : ''}>`;
  h += all ? `<option value="">${t('all_kw')}</option>` : `<option value="" disabled ${val ? '' : 'selected'}>${t('choose')}</option>`;
  for (const g of GOVS) {
    const list = S.areas.filter(a => a.gov === g); if (!list.length) continue;
    h += `<optgroup label="${esc(govName(g))}">`;
    if (gov) h += `<option value="gov:${g}" ${val === 'gov:' + g ? 'selected' : ''}>${esc(govName(g))} — ${t('all_gov')}</option>`;
    h += list.map(a => `<option value="${a.id}" ${String(val) === String(a.id) ? 'selected' : ''}>${esc(nm(a))}</option>`).join('') + '</optgroup>';
  }
  return h + '</select>';
}
const areaFilterLabel = v => !v ? t('all_kw') : v.startsWith('gov:') ? govName(v.slice(4)) : areaName(+v);

function filterSheet(f, onApply) {
  const c = S.cat[f.cat];
  const flds = c ? (c.fields || []).filter(x => x.t === 'select') : [];
  const pl = c ? t(c.price_label || 'price') : t('price');
  sheet(`<div class="sheet-body"><h3 class="sh-title">${t('filters')}</h3>
    <label class="lbl">${t('sort')}</label><div class="seg" data-sort>${['new', 'low', 'high'].map(s => `<button type="button" data-v="${s}" class="${f.sort === s ? 'on' : ''}">${t('sort_' + s)}</button>`).join('')}</div>
    <label class="lbl">${t('area')}</label>${areaSelect('area', f.area)}
    <label class="lbl">${esc(pl)} (${t('kwd')})</label><div class="row2"><input class="inp" name="min" inputmode="decimal" placeholder="${t('min')}" value="${esc(f.min)}"><input class="inp" name="max" inputmode="decimal" placeholder="${t('max')}" value="${esc(f.max)}"></div>
    ${flds.map(x => `<label class="lbl">${esc(nm(x))}</label><select class="inp" name="s_${esc(x.k)}"><option value="">${t('any')}</option>${(x.o || []).map(o => `<option value="${esc(o.v)}" ${f.specs[x.k] === o.v ? 'selected' : ''}>${esc(nm(o))}</option>`).join('')}</select>`).join('')}
    <label class="check"><input type="checkbox" name="photos" ${f.photos ? 'checked' : ''}><span>${t('with_photos')}</span></label>
    <div class="row2 sticky-act"><button class="btn primary" data-apply>${t('apply')}</button><button class="btn ghost" data-reset>${t('reset')}</button></div></div>`, {
    onOpen: sh => {
      let sort = f.sort;
      $$('[data-sort] button', sh).forEach(b => b.onclick = () => { sort = b.dataset.v; $$('[data-sort] button', sh).forEach(x => x.classList.toggle('on', x === b)); });
      $('[data-apply]', sh).onclick = () => {
        const nf = { cat: f.cat, q: f.q, sort, area: $('[name=area]', sh).value, min: digits($('[name=min]', sh).value), max: digits($('[name=max]', sh).value), photos: $('[name=photos]', sh).checked, specs: {} };
        flds.forEach(x => { const v = $(`[name="s_${x.k}"]`, sh).value; if (v) nf.specs[x.k] = v; });
        closeSheet(true, true); onApply(nf);
      };
      $('[data-reset]', sh).onclick = () => { closeSheet(true, true); onApply({ cat: f.cat, q: f.q, sort: 'new', area: '', min: '', max: '', photos: false, specs: {} }); };
    },
  });
}
function chipsHtml(f) {
  const c = S.cat[f.cat];
  const nFil = (f.area ? 1 : 0) + (f.min || f.max ? 1 : 0) + (f.photos ? 1 : 0) + Object.keys(f.specs).length + (f.sort !== 'new' ? 1 : 0);
  const quick = c && (c.fields || []).find(x => x.t === 'select' && x.filter);
  return `<div class="chips hscroll">
    <button class="chip strong${nFil ? ' on' : ''}" data-act="filters">${icon('filter')}${t('filters')}${nFil ? ` <b>${nFil}</b>` : ''}</button>
    <button class="chip${f.area ? ' on' : ''}" data-act="filters">${icon('pin')}${esc(areaFilterLabel(f.area))}</button>
    ${quick ? (quick.o || []).slice(0, 14).map(o => `<button class="chip${f.specs[quick.k] === o.v ? ' on' : ''}" data-quick="${esc(quick.k)}" data-v="${esc(o.v)}">${esc(nm(o))}</button>`).join('') : ''}
  </div>`;
}
function bindListing(el, f, base) {
  const nav = nf => go(base + fToQuery(nf));
  $$('[data-act="filters"]', el).forEach(b => b.onclick = () => filterSheet(f, nav));
  $$('[data-quick]', el).forEach(b => b.onclick = () => { const nf = JSON.parse(JSON.stringify(f)); const k = b.dataset.quick; nf.specs[k] = nf.specs[k] === b.dataset.v ? '' : b.dataset.v; if (!nf.specs[k]) delete nf.specs[k]; nav(nf); });
  mountFeed(el, f, { countEl: $('.count', el) });
}
async function featuredStrip(el, cat) {
  if (!paid().enabled) return;
  const box = $('.featured', el); if (!box) return;
  try {
    const r = await rest(`market_ads?select=${AD_COLS}&status=eq.active&featured_until=gt.${new Date().toISOString()}${cat ? '&category_id=eq.' + cat : ''}&order=bumped_at.desc&limit=12`, { anon: true }) || [];
    if (!r.length) return;
    box.innerHTML = `<div class="sec-h"><h2>${icon('star')}${t('featured')}</h2></div><div class="hscroll frow">${r.map(featCard).join('')}</div>`;
  } catch (_) { }
}

/* ================= الصفحات ================= */
function brandHead() {
  return `<header class="hero">
    <div class="hero-top"><a class="brand" href="#/" aria-label="${t('app')}"><span class="logo">م</span><span><b>${t('app')}</b><small>${t('tagline')}</small></span></a>
      <div class="tb-act">${session() ? `<a class="icon-btn light" href="#/notifications" aria-label="${t('notifications')}">${icon('bell')}<i class="dot" id="ndot" hidden></i></a>` : ''}<button class="lang-btn" data-act="lang">${isAr() ? 'EN' : 'ع'}</button></div></div>
    <form class="searchbar" data-search role="search"><span>${icon('search')}</span><input name="q" type="search" enterkeyhint="search" placeholder="${t('search_ph')}" autocomplete="off"><button class="btn sm primary" type="submit">${t('search')}</button></form>
  </header>`;
}
const catTile = c => `<a class="ctile" href="#/c/${esc(c.id)}"><span class="ci">${catIcon(c)}</span><b>${esc(nm(c))}</b></a>`;

function pgHome() {
  return {
    html: `${brandHead()}<div class="page">
      <section class="cgrid">${S.cats.map(catTile).join('')}</section>
      <a class="cta" href="#/post"><span class="cta-i">${icon('plus')}</span><span><b>${t('post')}</b><small>${t('free_note')}</small></span>${icon(isAr() ? 'chevL' : 'chevR')}</a>
      <div class="featured"></div>
      <div class="sec-h"><h2>${t('latest')}</h2></div>${feedBox()}</div>`,
    after: el => { mountFeed(el, { sort: 'new', specs: {} }); featuredStrip(el); bindSearch(el); },
  };
}
function bindSearch(el) {
  const fm = $('[data-search]', el); if (!fm) return;
  fm.onsubmit = e => { e.preventDefault(); const q = fm.q.value.trim(); if (q) { track('m_search'); go('/search?q=' + encodeURIComponent(q)); } };
}
function pgCats() {
  return { html: topbar(t('cats'), { back: false }) + `<div class="page"><div class="clist">${S.cats.map(c => `<a class="crow" href="#/c/${esc(c.id)}"><span class="ci">${catIcon(c)}</span><b>${esc(nm(c))}</b>${icon(isAr() ? 'chevL' : 'chevR', 'chev')}</a>`).join('')}</div></div>` };
}
function pgCategory([id], q) {
  const c = S.cat[id]; if (!c) return { html: topbar(t('cats')) + emptyBox('grid', t('not_found')) };
  const f = parseF(q); f.cat = id;
  return {
    html: topbar(nm(c), { actions: `<a class="icon-btn" href="#/search?cat=${esc(id)}" aria-label="${t('search')}">${icon('search')}</a>` }) +
      `<div class="page">${chipsHtml(f)}<div class="featured"></div><div class="listhead"><span class="count"></span><a class="btn sm soft" href="#/post?cat=${esc(id)}">${icon('plus')}${t('post')}</a></div>${feedBox()}</div>`,
    after: el => { bindListing(el, f, '/c/' + id); featuredStrip(el, id); },
  };
}
function pgSearch(_, q) {
  const f = parseF(q);
  const cats = `<div class="chips hscroll"><button class="chip${!f.cat ? ' on' : ''}" data-cat="">${t('all_cats')}</button>${S.cats.map(c => `<button class="chip${f.cat === c.id ? ' on' : ''}" data-cat="${esc(c.id)}">${esc(nm(c))}</button>`).join('')}</div>`;
  return {
    html: `<header class="topbar search-top"><button class="icon-btn" data-act="back" aria-label="${t('back')}">${icon(isAr() ? 'chevR' : 'chevL')}</button>
      <form class="searchbar mini" data-s2 role="search"><span>${icon('search')}</span><input name="q" type="search" enterkeyhint="search" value="${esc(f.q)}" placeholder="${t('search_ph')}" autocomplete="off"></form></header>
      <div class="page">${cats}${chipsHtml(f)}<div class="listhead"><span class="count"></span></div>${feedBox()}</div>`,
    after: el => {
      const fm = $('[data-s2]', el), inp = fm.q;
      if (!f.q && !f.cat) setTimeout(() => inp.focus(), 60);
      const nav = nf => go('/search' + fToQuery(nf, true), true);
      fm.onsubmit = e => { e.preventDefault(); inp.blur(); track('m_search'); nav(Object.assign({}, f, { q: inp.value.trim() })); };
      $$('[data-cat]', el).forEach(b => b.onclick = () => nav(Object.assign({}, f, { cat: b.dataset.cat, specs: {} })));
      $$('[data-act="filters"]', el).forEach(b => b.onclick = () => filterSheet(f, nav));
      $$('[data-quick]', el).forEach(b => b.onclick = () => { const nf = JSON.parse(JSON.stringify(f)); const k = b.dataset.quick; if (nf.specs[k] === b.dataset.v) nf.specs[k] = ''; else nf.specs[k] = b.dataset.v; nav(nf); });
      if (f.q || f.cat || Object.keys(f.specs).length || f.area) mountFeed(el, f, { countEl: $('.count', el) });
      else $('.feed', el).innerHTML = emptyBox('search', t('search'), t('search_ph'));
    },
  };
}

/* ---------- صفحة الإعلان ---------- */
async function pgAd([id]) {
  id = +id;
  let a = null;
  try { a = ((await rest(`market_ads?select=*&id=eq.${id}`)) || [])[0]; } catch (e) { return { html: topbar('') + emptyBox('refresh', t('error'), errText(e)) }; }
  if (!a) return { html: topbar('') + emptyBox('search', t('not_found'), t('not_found_sub'), `<a class="btn primary sm" href="#/">${t('home')}</a>`) };
  const c = S.cat[a.category_id], mine = session() && a.user_id === session().uid;
  const imgs = (a.images || []).map(safeImg).filter(Boolean);
  const specs = specsList(a);
  if (a.status === 'active' || a.status === 'sold') track('ad_view', id);
  const statusNote = a.status === 'pending' ? `<div class="note warn">${icon('clock')}${t('pending_note')}</div>` : a.status === 'removed' ? `<div class="note err">${icon('ban')}${t('removed')}${a.removed_reason && a.removed_reason !== 'banned' ? ' — ' + esc(t('removed_note', { r: a.removed_reason })) : ''}</div>` : a.status === 'hidden' ? `<div class="note">${icon('eyeOff')}${t('hidden')}</div>` : '';
  const html = `<div class="adpage">
    <div class="gal${imgs.length ? '' : ' empty'}">
      <div class="gal-top"><button class="icon-btn glass" data-act="back" aria-label="${t('back')}">${icon(isAr() ? 'chevR' : 'chevL')}</button><span class="sp"></span>
        <button class="icon-btn glass" data-act="share" aria-label="${t('share')}">${icon('share')}</button>
        <button class="icon-btn glass fav${S.favs.has(id) ? ' on' : ''}" data-fav="${id}" aria-label="${t('favs')}">${icon('heart')}</button></div>
      ${imgs.length ? `<div class="gal-track" dir="ltr">${imgs.map((u, i) => `<img src="${esc(u)}" alt="" data-i="${i}" ${i ? 'loading="lazy"' : ''}>`).join('')}</div>${imgs.length > 1 ? `<span class="gal-n"><b>1</b>/${imgs.length}</span>` : ''}` : `<span class="noimg big">${catIcon(c)}</span>`}
      ${a.status === 'sold' ? `<span class="badge sold big">${t('sold')}</span>` : ''}
    </div>
    <div class="page ad-body">${statusNote}
      <div class="ad-head">${priceHtml(a, true)}<h1>${esc(a.title)}</h1>
        <div class="mt"><a href="#/c/${esc(a.category_id)}">${catIcon(c)}${esc(nm(c))}</a><span>${icon('pin')}${esc(areaFull(a.area_id))}</span><span>${icon('clock')}${esc(ago(a.bumped_at))}</span></div></div>
      ${specs.length ? `<section class="box"><h2>${t('details')}</h2><dl class="specs">${specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>` : ''}
      ${a.description ? `<section class="box"><h2>${t('description')}</h2><p class="desc">${esc(a.description)}</p></section>` : ''}
      ${mine ? ownerPanel(a) : ''}
      <div class="ad-meta"><span>${t('ad_no')}: <b dir="ltr">#${a.id}</b></span><span>${icon('eye')}${fmtNum(a.views)} ${t('views')}</span><span>${t('posted')} ${esc(fmtDate(a.created_at))}</span></div>
      <p class="safety">${icon('shield')}${t('safety')}</p>
      ${!mine && (a.status === 'active' || a.status === 'sold') ? `<button class="link-btn" data-act="report">${icon('flag')}${t('report')}</button>` : ''}
      <div class="similar"></div>
    </div>
    ${!mine && a.status !== 'removed' ? `<div class="contact-bar">
      <a class="btn call" href="tel:+965${esc(a.phone)}" data-track="ad_call">${icon('phoneCall')}<span>${t('call')}</span><small dir="ltr">${esc(a.phone)}</small></a>
      ${a.show_whatsapp ? `<a class="btn wa" href="${esc(waLink(a.phone, t('wa_msg', { t: a.title + ' — ' + adUrl(a.id) })))}" target="_blank" rel="noopener" data-track="ad_whatsapp">${icon('wa')}<span>${t('whatsapp')}</span></a>` : ''}
    </div>` : ''}
  </div>`;
  return {
    html, cls: 'no-tab',
    after: el => {
      const tr = $('.gal-track', el), n = $('.gal-n b', el);
      if (tr && n) tr.addEventListener('scroll', () => { n.textContent = Math.round(Math.abs(tr.scrollLeft) / tr.clientWidth) + 1; }, { passive: true });
      if (tr) $$('img', tr).forEach(im => im.onclick = () => viewer(imgs, +im.dataset.i));
      $$('[data-track]', el).forEach(b => b.addEventListener('click', () => track(b.dataset.track, id)));
      const sh = $('[data-act="share"]', el); if (sh) sh.onclick = () => share(a);
      const rp = $('[data-act="report"]', el); if (rp) rp.onclick = () => reportSheet(id);
      bindOwner(el, a);
      loadSimilar($('.similar', el), a);
    },
  };
}
async function loadSimilar(box, a) {
  try {
    const r = await rest(`market_ads?select=${AD_COLS}&status=eq.active&category_id=eq.${a.category_id}&id=neq.${a.id}&order=bumped_at.desc&limit=6`, { anon: true }) || [];
    if (r.length) box.innerHTML = `<div class="sec-h"><h2>${t('similar')}</h2><a href="#/c/${esc(a.category_id)}">${t('see_all')}</a></div><div class="feed">${r.map(card).join('')}</div>`;
  } catch (_) { }
}
function viewer(imgs, i) {
  const o = document.createElement('div'); o.className = 'viewer';
  o.innerHTML = `<button class="icon-btn glass vx" aria-label="${t('close')}">${icon('close')}</button><div class="v-track" dir="ltr">${imgs.map(u => `<div><img src="${esc(u)}" alt=""></div>`).join('')}</div>`;
  document.body.appendChild(o); document.body.classList.add('noscroll');
  const tr = $('.v-track', o); requestAnimationFrame(() => { tr.scrollLeft = tr.clientWidth * i; });
  const end = () => { o.remove(); document.body.classList.remove('noscroll'); removeEventListener('keydown', k); };
  const k = e => { if (e.key === 'Escape') end(); };
  addEventListener('keydown', k); $('.vx', o).onclick = end;
}
async function share(a) {
  const url = adUrl(a.id);
  try { if (navigator.share) { await navigator.share({ title: a.title, text: a.title, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast(t('copied'), 'ok'); } catch (_) { promptBox(t('share'), { value: url, ok: t('close') }); }
}
function reportSheet(id) {
  const reasons = ['spam', 'fraud', 'prohibited', 'wrong_category', 'duplicate', 'sold', 'offensive', 'other'];
  sheet(`<div class="sheet-body"><h3 class="sh-title">${t('report_title')}</h3><div class="radios">${reasons.map((r, i) => `<label class="radio"><input type="radio" name="r" value="${r}" ${i ? '' : 'checked'}><span>${t('r_' + r)}</span></label>`).join('')}</div>
    <label class="lbl">${t('report_details')}</label><textarea class="inp" rows="3" maxlength="500" name="d"></textarea>
    <button class="btn danger block" data-send style="margin-top:14px">${icon('flag')}${t('send')}</button></div>`, {
    onOpen: sh => $('[data-send]', sh).onclick = e => busy(e.currentTarget, async () => {
      try { await rpc('report_market_ad', { p_id: id, p_reason: $('input[name=r]:checked', sh).value, p_details: $('[name=d]', sh).value.trim() || null }); closeSheet(); toast(t('report_ok'), 'ok'); }
      catch (err) { toast(errText(err), 'err'); }
    }),
  });
}
function ownerPanel(a) {
  const st = a.status; const pa = paid();
  return `<section class="box owner"><h2>${t('my_ads')} · <span class="st st-${st}">${t(st)}</span></h2>
    ${st === 'removed' && a.removed_reason ? `<p class="muted">${esc(t('removed_note', { r: a.removed_reason === 'banned' ? t('banned') : a.removed_reason }))}</p>` : ''}
    <div class="own-acts">
      ${st !== 'removed' && st !== 'pending' ? `<a class="btn soft sm" href="#/edit/${a.id}">${icon('edit')}${t('edit')}</a>` : ''}
      ${st === 'active' ? `<button class="btn soft sm" data-own="bump">${icon('arrowUp')}${t('bump')}</button><button class="btn soft sm" data-own="sold">${icon('tag')}${t('mark_sold')}</button><button class="btn soft sm" data-own="hide">${icon('eyeOff')}${t('hide')}</button>` : ''}
      ${st === 'sold' || st === 'hidden' ? `<button class="btn soft sm" data-own="active">${icon('refresh')}${t('mark_active')}</button>` : ''}
      <button class="btn soft sm danger-t" data-own="del">${icon('trash')}${t('del')}</button>
    </div>
    ${pa.enabled && st === 'active' ? `<div class="feat-box"><b>${icon('star')}${t('feature_ad')}</b><p>${t('feature_sub')}</p><div class="chips">${Object.entries(pa.featured_prices || {}).map(([d, p]) => `<span class="chip">${d} ${isAr() ? 'يوم' : 'days'} · ${fmtNum(p)} ${t('kwd')}</span>`).join('')}</div>
      <a class="btn wa sm" target="_blank" rel="noopener" href="${esc('https://wa.me/' + CFG.supportWa + '?text=' + encodeURIComponent((isAr() ? 'أبي أميّز إعلاني رقم #' : 'I want to feature my ad #') + a.id))}">${icon('wa')}${t('feature_contact')}</a></div>` : ''}
  </section>`;
}
function bindOwner(el, a) {
  $$('[data-own]', el).forEach(b => b.onclick = () => ownerAction(b, a, () => render(true)));
}
async function ownerAction(b, a, done) {
  const act = b.dataset.own;
  if (act === 'del') {
    if (!(await confirmBox(t('del_q'), { ok: t('del'), danger: true }))) return;
    return busy(b, async () => { try { await rest('market_ads?id=eq.' + a.id, { method: 'DELETE' }); removeImages(a.images); toast(t('saved'), 'ok'); if (/^#\/ad\//.test(location.hash)) go('/my', true); else done(); } catch (e) { toast(errText(e), 'err'); } });
  }
  if (act === 'sold' && !(await confirmBox(t('sold_q'), { ok: t('mark_sold') }))) return;
  busy(b, async () => {
    try {
      if (act === 'bump') { await rpc('bump_market_ad', { p_id: a.id }); toast(t('bumped'), 'ok'); }
      else { await rest('market_ads?id=eq.' + a.id, { method: 'PATCH', body: { status: act === 'hide' ? 'hidden' : act }, prefer: 'return=minimal' }); toast(t('saved'), 'ok'); }
      done();
    } catch (e) { toast(errText(e), 'err'); }
  });
}

/* ---------- الحساب والدخول ---------- */
function authForm(mode) {
  const reg = mode === 'register';
  return `<form class="auth" data-auth="${mode}" novalidate>
    <div class="seg"><button type="button" data-mode="login" class="${reg ? '' : 'on'}">${t('login')}</button><button type="button" data-mode="register" class="${reg ? 'on' : ''}">${t('register')}</button></div>
    <label class="lbl">${t('phone')}</label><div class="phone-inp" dir="ltr"><span>+965</span><input class="inp" name="phone" inputmode="tel" autocomplete="tel-national" maxlength="12" placeholder="5xxxxxxx" required></div>
    ${reg ? `<label class="lbl">${t('name_opt')}</label><input class="inp" name="name" maxlength="60" autocomplete="name">` : ''}
    <label class="lbl">${t('password')}</label><div class="pass"><input class="inp" name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required minlength="8" maxlength="72"><button type="button" class="icon-btn" data-eye aria-label="show">${icon('eye')}</button></div>
    ${reg ? `<p class="hint">${t('pass_hint')}</p>` : ''}
    <button class="btn primary block lg" type="submit">${reg ? t('register') : t('login')}</button>
    ${reg ? '' : `<button type="button" class="link-btn center" data-forgot>${t('forgot')}</button>`}
  </form>`;
}
function bindAuth(root, done) {
  const f = $('form.auth', root);
  $$('[data-mode]', f).forEach(b => b.onclick = () => { f.outerHTML = authForm(b.dataset.mode); bindAuth(root, done); });
  $('[data-eye]', f).onclick = () => { const p = f.password; p.type = p.type === 'password' ? 'text' : 'password'; };
  const fg = $('[data-forgot]', f); if (fg) fg.onclick = forgotSheet;
  f.onsubmit = e => {
    e.preventDefault();
    const phone = localPhone(f.phone.value), pw = f.password.value, reg = f.dataset.auth === 'register';
    if (!phone) return toast(errText('invalid phone'), 'err');
    if (reg && (pw.length < 8 || !/\d/.test(pw) || !/\D/.test(pw))) return toast(errText('weak password'), 'err');
    busy($('[type=submit]', f), async () => {
      try {
        if (reg) await register(phone, pw, f.name.value.trim()); else await login(phone, pw);
        await loadMe(); await syncFavs(); toast(t('welcome') + (S.me && S.me.full_name ? (isAr() ? '، ' : ', ') + S.me.full_name : ''), 'ok'); done();
      } catch (err) { toast(errText(err), 'err'); }
    });
  };
}
function forgotSheet() {
  sheet(`<div class="sheet-body"><h3 class="sh-title">${t('reset_pass')}</h3><p class="muted">${t('forgot_sub')}</p>
    <label class="lbl">${t('phone')}</label><input class="inp" name="p" inputmode="tel" dir="ltr" placeholder="5xxxxxxx">
    <label class="lbl">${t('recovery_code')}</label><input class="inp" name="c" dir="ltr" autocapitalize="characters" placeholder="XXXXXX-XXXXXX-XXXXXX">
    <label class="lbl">${t('new_password')}</label><input class="inp" name="n" type="password" autocomplete="new-password"><p class="hint">${t('pass_hint')}</p>
    <button class="btn primary block" data-go>${t('reset_pass')}</button>
    <a class="btn wa block" style="margin-top:10px" target="_blank" rel="noopener" href="https://wa.me/${esc(CFG.supportWa)}">${icon('wa')}${t('support')}</a></div>`, {
    onOpen: sh => $('[data-go]', sh).onclick = e => busy(e.currentTarget, async () => {
      const p = localPhone($('[name=p]', sh).value), c = $('[name=c]', sh).value.trim(), np = $('[name=n]', sh).value;
      if (!p) return toast(errText('invalid phone'), 'err');
      try { const ok = await rpc('reset_password_with_recovery', { p_phone: p, p_code: c, p_new_password: np }, { anon: true }); if (ok) { closeSheet(); toast(t('reset_ok'), 'ok'); } else toast(t('reset_bad'), 'err'); }
      catch (err) { toast(errText(err), 'err'); }
    }),
  });
}
function pgLogin(_, q) {
  const next = q.get('next') || '/me';
  if (session()) { setTimeout(() => go(next, true)); return { html: '' }; }
  return {
    html: topbar(t('login')) + `<div class="page narrow"><div class="auth-hero"><span class="logo lg">م</span><h2>${t(next.startsWith('/post') ? 'login_to_post' : 'welcome')}</h2><p class="muted">${t('login_sub')}</p></div>${authForm(q.get('mode') === 'register' ? 'register' : 'login')}</div>`,
    after: el => bindAuth(el, () => go(next, true)),
  };
}
function requireLogin(path) { go('/login?next=' + encodeURIComponent(path) + '&mode=register', true); return { html: '' }; }

async function pgMe() {
  if (!session()) {
    return {
      html: topbar(t('me'), { back: false }) + `<div class="page narrow"><div class="prof guest"><span class="av">${icon('user')}</span><div><b>${t('guest')}</b><small>${t('guest_sub')}</small></div></div>
        ${authForm('register')}<div class="menu">${langRow()}${commonMenu()}</div></div>`,
      after: el => { bindAuth(el, () => render(true)); bindMenu(el); },
    };
  }
  if (!S.me) await loadMe();
  const me = S.me || {};
  return {
    html: topbar(t('me'), { back: false }) + `<div class="page narrow">
      <div class="prof"><span class="av">${esc((me.full_name || '').trim().slice(0, 1) || 'م')}</span><div><b>${esc(me.full_name || t('welcome'))}</b><small dir="ltr">+965 ${esc(me.phone || '')}</small></div><button class="icon-btn" data-m="name" aria-label="${t('edit_name')}">${icon('edit')}</button></div>
      ${me.is_banned ? `<div class="note err">${icon('ban')}<div><b>${t('banned')}</b><br>${t('banned_sub')}</div></div>` : ''}
      <div class="menu">
        <a href="#/my">${icon('layers')}<span>${t('my_ads')}</span>${icon(isAr() ? 'chevL' : 'chevR', 'chev')}</a>
        <a href="#/favs">${icon('heart')}<span>${t('favs')}</span>${icon(isAr() ? 'chevL' : 'chevR', 'chev')}</a>
        <a href="#/notifications">${icon('bell')}<span>${t('notifications')}</span><b class="cnt" id="ncnt" hidden></b>${icon(isAr() ? 'chevL' : 'chevR', 'chev')}</a>
        ${isStaff() ? `<a href="admin.html">${icon('shield')}<span>${t('admin_panel')}</span>${icon(isAr() ? 'chevL' : 'chevR', 'chev')}</a>` : ''}
      </div>
      <div class="menu">${langRow()}<button data-m="recovery">${icon('lock')}<span>${t('recovery')}</span>${icon(isAr() ? 'chevL' : 'chevR', 'chev')}</button>${commonMenu()}</div>
      <div class="menu"><button data-m="logout">${icon('logout')}<span>${t('logout')}</span></button><button data-m="delete" class="danger-t">${icon('trash')}<span>${t('del_account')}</span></button></div>
    </div>`,
    after: el => { bindMenu(el); unreadCount(); },
  };
}
const langRow = () => `<button data-m="lang">${icon('globe')}<span>${t('language')}</span><em>${isAr() ? 'العربية' : 'English'}</em></button>`;
const commonMenu = () => `${installable() ? `<button data-m="install">${icon('download')}<span>${t('install')}</span></button>` : ''}
  <a href="#/about">${icon('info')}<span>${t('about')}</span>${icon(isAr() ? 'chevL' : 'chevR', 'chev')}</a>
  <a href="#/terms">${icon('doc')}<span>${t('terms')}</span>${icon(isAr() ? 'chevL' : 'chevR', 'chev')}</a>
  <a href="https://wa.me/${esc(CFG.supportWa)}" target="_blank" rel="noopener">${icon('wa')}<span>${t('support')}</span>${icon(isAr() ? 'chevL' : 'chevR', 'chev')}</a>`;
function bindMenu(el) {
  $$('[data-m]', el).forEach(b => b.onclick = async () => {
    const m = b.dataset.m;
    if (m === 'lang') { setLang(isAr() ? 'en' : 'ar'); paintTabbar(); render(true); }
    else if (m === 'install') installApp();
    else if (m === 'logout') { await logout(); S.me = null; S.favs = new Set(); toast(t('logout')); go('/', true); }
    else if (m === 'delete') {
      if (!(await confirmBox(t('del_acc_q'), { ok: t('del_account'), danger: true }))) return;
      try { await rpc('delete_my_account'); await logout(); S.me = null; toast(t('saved')); go('/', true); } catch (e) { toast(errText(e), 'err'); }
    } else if (m === 'name') {
      const v = await promptBox(t('edit_name'), { value: (S.me && S.me.full_name) || '' }); if (v == null) return;
      try { await rest('profiles?id=eq.' + session().uid, { method: 'PATCH', body: { full_name: v.slice(0, 60) || null }, prefer: 'return=minimal' }); await loadMe(); render(true); toast(t('saved'), 'ok'); } catch (e) { toast(errText(e), 'err'); }
    } else if (m === 'recovery') recoverySheet();
  });
}
async function recoverySheet() {
  let has = false; try { has = await rpc('has_recovery_code'); } catch (_) { }
  sheet(`<div class="sheet-body"><h3 class="sh-title">${t('recovery')}</h3><p class="muted">${t('recovery_sub')}</p>${has ? `<p class="note">${t('recovery_have')}</p>` : ''}<div data-out></div><button class="btn primary block" data-mk>${t('recovery_make')}</button></div>`, {
    onOpen: sh => $('[data-mk]', sh).onclick = e => busy(e.currentTarget, async () => {
      try { const code = await rpc('create_recovery_code'); $('[data-out]', sh).innerHTML = `<div class="code" dir="ltr">${esc(code)}</div>`; e.currentTarget.hidden = true; try { await navigator.clipboard.writeText(code); toast(t('copied')); } catch (_) { } }
      catch (err) { toast(errText(err), 'err'); }
    }),
  });
}
async function unreadCount() {
  if (!session()) return;
  try { const r = await rest('notifications?select=id&read_at=is.null&limit=50') || []; const n = r.length; ['#ncnt', '#ndot'].forEach(s => { const b = $(s); if (b) { b.hidden = !n; if (s === '#ncnt') b.textContent = n; } }); } catch (_) { }
}
async function pgNotifications() {
  if (!session()) return requireLogin('/notifications');
  let list = [];
  try { list = await rest('notifications?select=id,title,body,created_at,read_at&order=created_at.desc&limit=50') || []; } catch (e) { return { html: topbar(t('notifications')) + emptyBox('refresh', t('error'), errText(e)) }; }
  const unread = list.filter(n => !n.read_at).map(n => n.id);
  if (unread.length) rest('notifications?id=in.(' + unread.join(',') + ')', { method: 'PATCH', body: { read_at: new Date().toISOString() }, prefer: 'return=minimal' }).catch(() => { });
  return { html: topbar(t('notifications')) + `<div class="page narrow">${list.length ? `<div class="notifs">${list.map(n => `<div class="notif${n.read_at ? '' : ' new'}"><b>${esc(n.title)}</b><p>${esc(n.body || '')}</p><small>${esc(ago(n.created_at))}</small></div>`).join('')}</div>` : emptyBox('bell', t('no_notifs'))}</div>` };
}

/* ---------- إعلاناتي والمفضلة ---------- */
async function pgMy(_, q) {
  if (!session()) return requireLogin('/my');
  const st = q.get('s') || 'all';
  let list = [];
  try { list = await rest(`market_ads?select=${AD_COLS},views,calls,wa_taps,removed_reason,user_id&user_id=eq.${session().uid}&order=created_at.desc&limit=200`) || []; }
  catch (e) { return { html: topbar(t('my_ads')) + emptyBox('refresh', t('error'), errText(e)) }; }
  const counts = list.reduce((m, a) => (m[a.status] = (m[a.status] || 0) + 1, m), {});
  const shown = st === 'all' ? list : list.filter(a => a.status === st);
  const tabs = ['all', 'active', 'sold', 'hidden', 'pending', 'removed'].filter(s => s === 'all' || counts[s]);
  return {
    html: topbar(t('my_ads'), { actions: `<a class="icon-btn" href="#/post" aria-label="${t('post')}">${icon('plus')}</a>` }) + `<div class="page">
      ${list.length ? `<div class="chips hscroll">${tabs.map(s => `<a class="chip${st === s ? ' on' : ''}" href="#/my${s === 'all' ? '' : '?s=' + s}">${s === 'all' ? t('status_all') : t(s)} <b>${s === 'all' ? list.length : counts[s]}</b></a>`).join('')}</div>` : ''}
      ${shown.length ? `<div class="mylist">${shown.map(a => `<div class="myrow">${card(a)}<div class="my-st"><span class="st st-${a.status}">${t(a.status)}</span><span>${icon('eye')}${fmtNum(a.views)}</span><span>${icon('phoneCall')}${fmtNum(a.calls)}</span><span>${icon('wa')}${fmtNum(a.wa_taps)}</span></div>
        <div class="own-acts">${a.status !== 'removed' && a.status !== 'pending' ? `<a class="btn soft xs" href="#/edit/${a.id}">${icon('edit')}${t('edit')}</a>` : ''}
        ${a.status === 'active' ? `<button class="btn soft xs" data-own="bump" data-id="${a.id}">${icon('arrowUp')}${t('bump')}</button><button class="btn soft xs" data-own="sold" data-id="${a.id}">${icon('tag')}${t('mark_sold')}</button>` : ''}
        ${a.status === 'sold' || a.status === 'hidden' ? `<button class="btn soft xs" data-own="active" data-id="${a.id}">${icon('refresh')}${t('mark_active')}</button>` : ''}
        <button class="btn soft xs danger-t" data-own="del" data-id="${a.id}">${icon('trash')}</button></div></div>`).join('')}</div>`
        : emptyBox('layers', t('no_my_ads'), t('no_my_ads_sub'), `<a class="btn primary" href="#/post">${icon('plus')}${t('post')}</a>`)}</div>`,
    after: el => $$('[data-own]', el).forEach(b => b.onclick = () => ownerAction(b, list.find(a => a.id === +b.dataset.id), () => render(true))),
  };
}
async function pgFavs() {
  const ids = [...S.favs];
  let list = [];
  if (ids.length) { try { list = await rest(`market_ads?select=${AD_COLS}&id=in.(${ids.slice(0, 200).join(',')})&order=bumped_at.desc`, { anon: !session() }) || []; } catch (e) { return { html: topbar(t('favs'), { back: false }) + emptyBox('refresh', t('error'), errText(e)) }; } }
  return { html: topbar(t('favs'), { back: false }) + `<div class="page">${list.length ? `<div class="feed">${list.map(card).join('')}</div>` : emptyBox('heart', t('no_favs'), t('no_favs_sub'))}</div>` };
}

/* ---------- إضافة / تعديل إعلان ---------- */
function pgPostPick(q) {
  if (!session()) return requireLogin('/post' + (q.toString() ? '?' + q : ''));
  if (S.me && S.me.is_banned) return { html: topbar(t('post')) + emptyBox('ban', t('banned'), t('banned_sub')) };
  const c = q.get('cat');
  if (c && S.cat[c]) return postForm(null, c);
  return {
    html: topbar(t('choose_cat'), { back: false }) + `<div class="page"><p class="free-note">${icon('check')}${t('free_note')}</p><section class="cgrid">${S.cats.map(c => `<a class="ctile" href="#/post?cat=${esc(c.id)}"><span class="ci">${catIcon(c)}</span><b>${esc(nm(c))}</b></a>`).join('')}</section></div>`,
  };
}
async function pgEdit([id]) {
  if (!session()) return requireLogin('/edit/' + id);
  let a; try { a = ((await rest(`market_ads?select=*&id=eq.${+id}&user_id=eq.${session().uid}`)) || [])[0]; } catch (e) { return { html: topbar(t('edit_ad')) + emptyBox('refresh', t('error'), errText(e)) }; }
  if (!a) return { html: topbar(t('edit_ad')) + emptyBox('search', t('not_found')) };
  return postForm(a, a.category_id);
}
function fieldInput(f, v) {
  const req = f.req ? ' required' : '', name = 'sp_' + f.k, star = f.req ? ' <i class="req">*</i>' : '';
  if (f.t === 'select') return `<label class="lbl">${esc(nm(f))}${star}</label><select class="inp" name="${esc(name)}"${req}><option value="">${t('choose')}</option>${(f.o || []).map(o => `<option value="${esc(o.v)}" ${v === o.v ? 'selected' : ''}>${esc(nm(o))}</option>`).join('')}</select>`;
  if (f.t === 'number') return `<label class="lbl">${esc(nm(f))}${star}</label><input class="inp" name="${esc(name)}" inputmode="numeric" value="${esc(v == null ? '' : v)}"${req}>`;
  return `<label class="lbl">${esc(nm(f))}${star}</label><input class="inp" name="${esc(name)}" maxlength="80" value="${esc(v || '')}"${req}>`;
}
function postForm(a, catId) {
  const c = S.cat[catId], edit = !!a, maxImg = Math.min(10, +market().max_images || 10);
  const pl = t(c.price_label || 'price');
  const photos = (a ? a.images : []).map(u => ({ url: u, prev: u }));
  const pt = a ? a.price_type : 'fixed';
  const html = topbar(edit ? t('edit_ad') : t('new_ad')) + `<form class="page narrow postform" novalidate>
    <div class="catpick"><span class="ci">${catIcon(c)}</span><b>${esc(nm(c))}</b>${edit ? '' : `<a class="btn ghost xs" href="#/post">${t('change_cat')}</a>`}</div>
    <label class="lbl">${t('photos')} <small>${t('photos_hint', { n: maxImg })}</small></label>
    <div class="photos" data-photos></div><input type="file" accept="image/*" multiple hidden data-file>
    <label class="lbl">${t('title')} <i class="req">*</i></label><input class="inp" name="title" maxlength="90" required value="${esc(a ? a.title : '')}" placeholder="${t('title_ph')}">
    ${(c.fields || []).map(f => fieldInput(f, a && a.specs ? a.specs[f.k] : undefined)).join('')}
    <label class="lbl">${esc(pl)}</label>
    <div class="seg wrap" data-pt>${['fixed', 'negotiable', 'ask', 'free'].map(p => `<button type="button" data-v="${p}" class="${pt === p ? 'on' : ''}">${t(p)}</button>`).join('')}</div>
    <div class="price-inp" data-pricebox ${pt === 'ask' || pt === 'free' ? 'hidden' : ''}><input class="inp" name="price" inputmode="decimal" placeholder="0" value="${esc(a && a.price != null ? +a.price : '')}"><span>${t('kwd')}</span></div>
    <label class="lbl">${t('area')} <i class="req">*</i></label>${areaSelect('area', a ? String(a.area_id) : '', { all: false, gov: false, req: true })}
    <label class="lbl">${t('description')}</label><textarea class="inp" name="description" rows="5" maxlength="3000" placeholder="${t('desc_ph')}">${esc(a ? a.description || '' : '')}</textarea>
    <label class="lbl">${t('contact_phone')}</label><div class="phone-ro" dir="ltr">+965 ${esc((a && a.phone) || (S.me && S.me.phone) || '')}</div><p class="hint">${t('phone_from_account')}</p>
    <label class="check"><input type="checkbox" name="wa" ${!a || a.show_whatsapp ? 'checked' : ''}><span>${icon('wa')}${t('show_wa')}</span></label>
    <button class="btn primary block lg" type="submit">${edit ? t('save') : t('publish')}</button>
    ${edit ? '' : `<p class="free-note center">${icon('check')}${t('free_note')}</p>`}
  </form>`;
  return {
    html, cls: 'no-tab',
    after: el => {
      const fm = $('form.postform', el), box = $('[data-photos]', el), file = $('[data-file]', el);
      let ptype = pt;
      const paint = () => {
        box.innerHTML = photos.map((p, i) => `<div class="pthumb${i ? '' : ' cover'}" data-i="${i}"><img src="${esc(p.prev)}" alt="">${i ? `<button type="button" class="pt-star" data-cov="${i}" aria-label="${t('cover')}">${icon('star')}</button>` : `<span class="pt-cov">${t('cover')}</span>`}<button type="button" class="pt-x" data-rm="${i}" aria-label="${t('del')}">${icon('close')}</button></div>`).join('')
          + (photos.length < maxImg ? `<button type="button" class="padd" data-add>${icon('camera')}<span>${t('add_photo')}</span><small>${photos.length}/${maxImg}</small></button>` : '');
        const ad = $('[data-add]', box); if (ad) ad.onclick = () => file.click();
        $$('[data-rm]', box).forEach(b => b.onclick = () => { const [p] = photos.splice(+b.dataset.rm, 1); if (p.file) URL.revokeObjectURL(p.prev); paint(); });
        $$('[data-cov]', box).forEach(b => b.onclick = () => { const [p] = photos.splice(+b.dataset.cov, 1); photos.unshift(p); paint(); });
      };
      paint();
      file.onchange = () => { [...file.files].slice(0, maxImg - photos.length).forEach(f => { if (/^image\//.test(f.type)) photos.push({ file: f, prev: URL.createObjectURL(f) }); }); file.value = ''; paint(); };
      $$('[data-pt] button', el).forEach(b => b.onclick = () => { ptype = b.dataset.v; $$('[data-pt] button', el).forEach(x => x.classList.toggle('on', x === b)); $('[data-pricebox]', el).hidden = ptype === 'ask' || ptype === 'free'; });
      fm.onsubmit = e => {
        e.preventDefault();
        const bad = el2 => { el2.classList.add('bad'); el2.focus(); el2.scrollIntoView({ block: 'center', behavior: 'smooth' }); toast(t('required'), 'err'); };
        $$('.bad', fm).forEach(x => x.classList.remove('bad'));
        const title = fm.title.value.trim(); if (title.length < 3) return bad(fm.title);
        const specs = {};
        for (const f of c.fields || []) {
          const inp = fm['sp_' + f.k]; if (!inp) continue; let v = inp.value.trim();
          if (f.t === 'number' && v !== '') { v = digits(v); if (v === '') return bad(inp); v = Math.min(+v, f.max || 1e9); }
          if (f.req && (v === '' || v == null)) return bad(inp);
          if (v !== '' && v != null) specs[f.k] = v;
        }
        let price = null;
        if (ptype === 'fixed' || ptype === 'negotiable') { const raw = String(fm.price.value).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d.]/g, ''); price = parseFloat(raw); if (!isFinite(price) || price < 0) return bad(fm.price); }
        const area = +fm.area.value; if (!area) return bad(fm.area);
        const btn = $('[type=submit]', fm);
        busy(btn, async () => {
          try {
            const uid = session().uid, urls = [], todo = photos.filter(p => !p.url).length; let k = 0;
            for (const p of photos) {
              if (p.url) { urls.push(p.url); continue; }
              k++; btn.lastChild && (btn.innerHTML = `<span class="spin"></span>${esc(t('uploading', { a: k, b: todo }))}`);
              const blob = await shrinkImage(p.file); p.url = await upload(uid + '/' + rnd() + '.jpg', blob); urls.push(p.url);
            }
            btn.innerHTML = `<span class="spin"></span>${esc(t('publishing'))}`;
            const body = { category_id: c.id, area_id: area, title, description: fm.description.value.trim() || null, price, price_type: ptype, specs, images: urls, show_whatsapp: fm.wa.checked };
            if (edit) {
              await rest('market_ads?id=eq.' + a.id, { method: 'PATCH', body, prefer: 'return=minimal' });
              removeImages((a.images || []).filter(u => !urls.includes(u)));
              toast(t('saved'), 'ok'); go('/ad/' + a.id, true);
            } else {
              const r = await rest('market_ads', { method: 'POST', body: Object.assign({ user_id: uid }, body), prefer: 'return=representation' });
              const ad = r && r[0];
              toast(ad && ad.status === 'pending' ? t('published_pending') : t('published'), 'ok');
              go('/ad/' + ad.id, true);
            }
          } catch (err) { toast(errText(err), 'err'); }
        }, t('publishing'));
      };
    },
  };
}

/* ---------- صفحات ثابتة ---------- */
function pgAbout() {
  const ar = isAr();
  return { html: topbar(t('about')) + `<div class="page narrow prose"><div class="auth-hero"><span class="logo lg">م</span><h2>${t('app')}</h2><p class="muted">${t('tagline')}</p></div>
    ${ar ? `<p>ماتعطل سوق كويتي مجاني للإعلانات المبوبة: سيارات، عقارات، هواتف، إلكترونيات، وكل شي تبي تبيعه أو تشتريه.</p><ul><li>تصفح بدون تسجيل.</li><li>انشر إعلانك مجاناً وبدون عمولة خلال دقيقة.</li><li>تواصل مباشر مع المعلن بالاتصال أو الواتساب.</li></ul>`
      : `<p>Matetattal is a free Kuwaiti classifieds marketplace: cars, real estate, phones, electronics and anything you want to buy or sell.</p><ul><li>Browse without an account.</li><li>Post ads for free with no commission.</li><li>Contact sellers directly by phone or WhatsApp.</li></ul>`}
    <a class="btn wa block" target="_blank" rel="noopener" href="https://wa.me/${esc(CFG.supportWa)}">${icon('wa')}${t('support')}</a></div>` };
}
function pgTerms() {
  const ar = isAr();
  return { html: topbar(t('terms')) + `<div class="page narrow prose">${ar ? `
    <h3>شروط الاستخدام</h3><ul><li>المعلن مسؤول عن صحة إعلانه وملكيته للسلعة.</li><li>يُمنع نشر السلع الممنوعة قانوناً في دولة الكويت، والإعلانات المضللة أو المكررة أو المسيئة.</li><li>ماتعطل وسيط إعلاني فقط ولا يتدخل في البيع أو الدفع أو التوصيل.</li><li>يحق للإدارة إيقاف أي إعلان أو حساب مخالف دون إشعار.</li></ul>
    <h3>الخصوصية</h3><ul><li>نحفظ رقم هاتفك واسمك وإعلاناتك فقط لتشغيل الخدمة.</li><li>رقمك يظهر داخل إعلاناتك ليتواصل معك المشترون.</li><li>نسجل إحصائيات عامة مجهولة (مشاهدات، اتصالات) لتحسين الخدمة.</li><li>تقدر تحذف حسابك وكل إعلاناتك نهائياً من صفحة «حسابي».</li></ul>`
      : `<h3>Terms of use</h3><ul><li>Advertisers are responsible for the accuracy of their ads and ownership of the items.</li><li>Items prohibited by Kuwaiti law, and misleading, duplicate or offensive ads are not allowed.</li><li>Matetattal is only an advertising platform and is not part of any sale, payment or delivery.</li><li>Admins may suspend any violating ad or account without notice.</li></ul>
    <h3>Privacy</h3><ul><li>We store your phone number, name and ads only to run the service.</li><li>Your number is shown on your ads so buyers can contact you.</li><li>We record anonymous aggregate stats (views, calls) to improve the service.</li><li>You can permanently delete your account and ads from the Account page.</li></ul>`}</div>` };
}

/* ================= التوجيه ================= */
const ROUTES = [
  [/^\/?$/, pgHome, 'home'], [/^\/cats$/, pgCats, 'cats'], [/^\/c\/([a-z0-9_]+)$/, pgCategory, 'cats'], [/^\/search$/, pgSearch, 'home'],
  [/^\/ad\/(\d+)$/, pgAd, ''], [/^\/post$/, (m, q) => pgPostPick(q), 'post'], [/^\/edit\/(\d+)$/, pgEdit, 'me'],
  [/^\/favs$/, pgFavs, 'favs'], [/^\/me$/, pgMe, 'me'], [/^\/my$/, pgMy, 'me'], [/^\/login$/, pgLogin, 'me'],
  [/^\/notifications$/, pgNotifications, 'me'], [/^\/about$/, pgAbout, 'me'], [/^\/terms$/, pgTerms, 'me'],
];
export function go(path, replace) {
  const h = '#' + path;
  if (replace) { history.replaceState(history.state && history.state.sheet ? null : history.state, '', h); render(); }
  else if (location.hash === h) render(true); else location.hash = h;
}
let renderSeq = 0; const scrollMem = {};
async function render(soft) {
  const seq = ++renderSeq;
  closeSheet(true, true);
  const raw = location.hash.slice(1) || '/'; const [path, qs] = raw.split('?');
  const q = new URLSearchParams(qs || '');
  let route = ROUTES.find(r => r[0].test(path)); if (!route) route = ROUTES[0];
  const m = path.match(route[0]).slice(1);
  const v = view();
  if (!soft) { v.innerHTML = `<div class="page"><div class="feed">${skeleton(4)}</div></div>`; }
  let out;
  try { out = await route[1](m, q); } catch (e) { console.error(e); out = { html: topbar(t('error')) + emptyBox('refresh', t('error'), errText(e)) }; }
  if (seq !== renderSeq) return;
  const prev = v.firstElementChild && v.firstElementChild._io; if (prev) prev.disconnect();
  v.innerHTML = out.html || '';
  document.body.classList.toggle('no-tab', out.cls === 'no-tab');
  $$('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === route[2]));
  if (out.after) try { out.after(v); } catch (e) { console.error(e); }
  if (!soft) window.scrollTo(0, scrollMem[raw] || 0);
}
addEventListener('scroll', () => { scrollMem[location.hash.slice(1) || '/'] = window.scrollY; }, { passive: true });

/* ================= أحداث عامة ================= */
document.addEventListener('click', e => {
  const fav = e.target.closest('[data-fav]');
  if (fav) { e.preventDefault(); e.stopPropagation(); toggleFav(fav.dataset.fav, fav); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'back') { let nav = false; try { nav = !!sessionStorage.getItem('m5_nav'); } catch (_) { } if (nav) history.back(); else go('/', true); }
  if (a.dataset.act === 'lang') { setLang(isAr() ? 'en' : 'ar'); paintTabbar(); render(true); }
});
addEventListener('hashchange', () => { try { sessionStorage.setItem('m5_nav', '1'); } catch (_) { } render(); });
addEventListener('offline', () => toast(t('offline'), 'err'));

function paintTabbar() {
  const tb = $('.tabbar'); if (!tb) return;
  tb.setAttribute('aria-label', t('home'));
  tb.innerHTML = `<a href="#/" data-tab="home">${icon('home')}<span>${t('home')}</span></a>
    <a href="#/cats" data-tab="cats">${icon('grid')}<span>${t('cats')}</span></a>
    <a href="#/post" data-tab="post" class="fab"><span class="c">${icon('plus')}</span><span>${t('post')}</span></a>
    <a href="#/favs" data-tab="favs">${icon('heart')}<span>${t('favs')}</span></a>
    <a href="#/me" data-tab="me">${icon('user')}<span>${t('me')}</span></a>`;
  document.title = t('app') + ' | ' + t('tagline');
}

/* ================= التثبيت ================= */
let deferredPrompt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const installable = () => !standalone() && (deferredPrompt || /iphone|ipad|ipod/i.test(navigator.userAgent));
async function installApp() {
  if (deferredPrompt) { deferredPrompt.prompt(); try { await deferredPrompt.userChoice; } catch (_) { } deferredPrompt = null; return; }
  sheet(`<div class="sheet-body"><h3 class="sh-title">${t('install')}</h3><p>${t('install_ios')}</p><button class="btn primary block" data-close>${t('close')}</button></div>`);
}

/* ================= التشغيل ================= */
async function boot() {
  initSession();
  paintTabbar();
  onAuth(s => { if (!s) { S.me = null; } });
  try { await loadPublic(); } catch (e) { view().innerHTML = `<div class="page">${emptyBox('refresh', t('error'), errText(e), '<button class="btn primary" data-reload>' + t('retry') + '</button>')}</div>`; $('[data-reload]').onclick = () => location.reload(); const sp = $('#splash'); if (sp) sp.remove(); return; }
  S.favs = localFavs();
  const meP = session() ? loadMe().then(syncFavs) : Promise.resolve();
  if (session()) await Promise.race([meP, new Promise(r => setTimeout(r, 1500))]);
  await render();
  window.__m5ok = true;
  const sp = $('#splash'); if (sp) { sp.classList.add('out'); setTimeout(() => sp.remove(), 400); }
  track('m_visit');
  meP.then(() => { unreadCount(); }).catch(() => { });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
}
boot();
