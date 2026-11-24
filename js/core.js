// ماتعطل v5 — الوحدة المشتركة: الاتصال بالخادم، الحسابات، الصور، الأيقونات، عناصر الواجهة
// المفتاح أدناه هو المفتاح العام (publishable) فقط. الصلاحيات الفعلية تُفرض في الخادم عبر RLS والدوال.
import { t, lang } from './i18n.js?v=502';
export const CFG = {
  url: 'https://xpnwhvbxordtsmnegvri.supabase.co',
  key: 'sb_publishable_n7zs9ZZSp98MURnnpu3UAw_-OhKNHH9',
  supportWa: '96565755222',
  bucket: 'market',
};
CFG.publicPrefix = CFG.url + '/storage/v1/object/public/';

/* ---------------- أدوات عامة ---------------- */
export const esc = s => String(s == null ? '' : s).replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const digits = s => String(s || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '');
/** رقم كويتي محلي من 8 أرقام أو '' */
export function localPhone(s) { let d = digits(s); if (d.length === 11 && d.startsWith('965')) d = d.slice(3); if (d.length === 13 && d.startsWith('00965')) d = d.slice(5); return /^[2569]\d{7}$/.test(d) ? d : ''; }
export const rnd = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const safeImg = u => (typeof u === 'string' && u.startsWith(CFG.publicPrefix) && /^https:\/\/[^\s"'<>]+$/.test(u)) ? u : '';
export const fmtNum = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
export const fmtDate = s => { try { return new Date(s).toLocaleDateString(lang() === 'ar' ? 'ar-KW-u-nu-latn' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (_) { return String(s).slice(0, 10); } };
export function ago(s) {
  const d = (Date.now() - new Date(s).getTime()) / 1000;
  if (!(d >= 0) || d < 60) return t('just_now');
  const rt = new Intl.RelativeTimeFormat(lang() === 'ar' ? 'ar-u-nu-latn' : 'en', { numeric: 'auto' });
  if (d < 3600) return rt.format(-Math.floor(d / 60), 'minute');
  if (d < 86400) return rt.format(-Math.floor(d / 3600), 'hour');
  if (d < 86400 * 30) return rt.format(-Math.floor(d / 86400), 'day');
  return fmtDate(s);
}
/** تطبيع النص العربي للبحث */
export const norm = s => String(s || '').toLowerCase().replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
export const store = {
  get(k, d = null) { try { const v = localStorage.getItem('m5_' + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem('m5_' + k, JSON.stringify(v)); } catch (_) { } },
  del(k) { try { localStorage.removeItem('m5_' + k); } catch (_) { } },
};

/* ---------------- الجلسة ---------------- */
let SES = null;
const SKEY = 'm5_session';
const readSes = () => { try { return JSON.parse(localStorage.getItem(SKEY) || localStorage.getItem('m3_session')); } catch (_) { return null; } };
function writeSes(s) {
  SES = s;
  try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); localStorage.removeItem('m3_session'); } catch (_) { }
  authListeners.forEach(f => { try { f(s); } catch (_) { } });
}
const authListeners = new Set();
export const onAuth = f => authListeners.add(f);
export function initSession() { SES = readSes(); return SES; }
export const session = () => SES;
const mkSes = j => ({ at: j.access_token, rt: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000, uid: j.user && j.user.id });

let refreshing = null;
export async function token() {
  if (!SES) return null;
  if (Date.now() < SES.exp - 60000) return SES.at;
  if (!refreshing) refreshing = (async () => {
    try { const j = await raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: SES.rt } }); writeSes(mkSes(j)); return SES.at; }
    catch (e) { if (e.status === 400 || e.status === 401 || e.status === 403) writeSes(null); throw e; }
    finally { setTimeout(() => { refreshing = null; }, 0); }
  })();
  return refreshing;
}

/* ---------------- طلبات الخادم ---------------- */
async function raw(path, o = {}) {
  const h = { apikey: CFG.key };
  if (o.tok) h.Authorization = 'Bearer ' + o.tok;
  if (o.body !== undefined) h['Content-Type'] = 'application/json';
  const pref = [o.prefer, o.count ? 'count=exact' : ''].filter(Boolean).join(',');
  if (pref) h.Prefer = pref;
  let r;
  try { r = await fetch(CFG.url + path, { method: o.method || 'GET', headers: h, body: o.body === undefined ? undefined : JSON.stringify(o.body), cache: 'no-store', signal: o.signal }); }
  catch (e) { if (e && e.name === 'AbortError') throw e; const x = new Error('Failed to fetch'); x.net = true; throw x; }
  const tx = await r.text(); let j = null; try { j = tx ? JSON.parse(tx) : null; } catch (_) { }
  if (!r.ok) { const x = new Error((j && (j.message || j.msg || j.error_description || j.error_code || j.error)) || ('HTTP ' + r.status)); x.status = r.status; x.code = j && j.code; throw x; }
  if (o.count) { const cr = r.headers.get('content-range') || ''; const n = +(cr.split('/')[1]); return { rows: j || [], total: isFinite(n) ? n : null }; }
  return j;
}
/** طلب للخادم؛ يرفق توكن المستخدم تلقائياً إن وُجد */
export async function api(path, o = {}) {
  const tok = o.anon ? null : await token().catch(() => null);
  return raw(path, Object.assign({}, o, { tok }));
}
export const rpc = (fn, args = {}, o = {}) => api('/rest/v1/rpc/' + fn, Object.assign({ method: 'POST', body: args }, o));
export const rest = (q, o) => api('/rest/v1/' + q, o);

/* ---------------- الحسابات (رقم الهاتف + كلمة السر) ---------------- */
export const phoneEmail = p => '965' + p + '@users.matattal.invalid';
export async function login(identifier, password) {
  const id = String(identifier || '').trim();
  let email;
  if (id.includes('@')) email = id.toLowerCase();
  else { const p = localPhone(id); if (!p) throw new Error('invalid phone'); email = phoneEmail(p); }
  const j = await raw('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  writeSes(mkSes(j));
  return SES;
}
export async function register(phone, password, name) {
  const p = localPhone(phone); if (!p || /^2/.test(p)) throw new Error('invalid phone');
  await raw('/rest/v1/rpc/register_account', { method: 'POST', body: { p_phone: p, p_password: password, p_name: name || null } });
  return login(p, password);
}
export async function logout() {
  const tk = SES && SES.at;
  writeSes(null);
  if (tk) { try { await raw('/auth/v1/logout', { method: 'POST', tok: tk }); } catch (_) { } }
}
export async function myProfile() {
  if (!SES) return null;
  const r = await rest('profiles?select=id,full_name,phone,role,is_banned,banned_reason,created_at&id=eq.' + encodeURIComponent(SES.uid));
  return (r && r[0]) || null;
}

/* ---------------- الصور ---------------- */
export function shrinkImage(file, max = 1280, q = 0.82) {
  return new Promise((res, rej) => {
    if (!file || !/^image\//.test(file.type)) return rej(new Error('invalid image'));
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u); c.toBlob(b => b ? res(b) : rej(new Error('invalid image')), 'image/jpeg', q);
    };
    im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('invalid image')); };
    im.src = u;
  });
}
export async function upload(path, blob) {
  const tok = await token();
  if (!tok) throw new Error('session');
  let r;
  try { r = await fetch(CFG.url + '/storage/v1/object/' + CFG.bucket + '/' + path, { method: 'POST', headers: { apikey: CFG.key, Authorization: 'Bearer ' + tok, 'Content-Type': 'image/jpeg', 'cache-control': 'max-age=31536000', 'x-upsert': 'false' }, body: blob }); }
  catch (_) { throw new Error('Failed to fetch'); }
  if (!r.ok) { let m = ''; try { const j = await r.json(); m = j.message || j.error || ''; } catch (_) { } throw new Error(m || ('HTTP ' + r.status)); }
  return CFG.publicPrefix + CFG.bucket + '/' + path;
}
/** حذف صور من التخزين (يتجاهل الأخطاء) */
export async function removeImages(urls) {
  const pre = CFG.publicPrefix + CFG.bucket + '/';
  const names = (urls || []).filter(u => typeof u === 'string' && u.startsWith(pre)).map(u => u.slice(pre.length));
  if (!names.length) return;
  try { const tok = await token(); await fetch(CFG.url + '/storage/v1/object/' + CFG.bucket, { method: 'DELETE', headers: { apikey: CFG.key, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: names }) }); } catch (_) { }
}
/** صورة مصغّرة عبر خدمة تحويل الصور إن توفرت، وإلا الأصل */
export const thumb = u => safeImg(u);

/* ---------------- الأيقونات (خط 1.7، مجموعة موحّدة) ---------------- */
const P = {
  home: '<path d="M3.5 10.5 12 3.8l8.5 6.7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  phoneCall: '<path d="M5 3.5h3.2l1.6 4.2-2.2 1.5a11 11 0 0 0 7.2 7.2l1.5-2.2 4.2 1.6V19a1.5 1.5 0 0 1-1.6 1.5C10.4 20 4 13.6 3.5 5.1A1.5 1.5 0 0 1 5 3.5z"/>',
  wa: '<path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.4-4.2a8.5 8.5 0 1 1 15.6-4.6z"/><path d="M8.7 8.6c.2-.6.6-.7 1-.7h.5c.2 0 .4.1.5.4l.7 1.6c.1.3 0 .5-.1.7l-.5.6c-.1.2-.1.3 0 .5a6 6 0 0 0 2.6 2.4c.2.1.4.1.5-.1l.6-.7c.2-.2.4-.2.7-.1l1.5.7c.3.1.4.3.4.5 0 .5-.2 1.2-.8 1.5-.6.4-1.5.5-2.8 0a9.3 9.3 0 0 1-4.6-4.4c-.6-1.2-.5-2.2-.2-2.9z" fill="currentColor" stroke="none"/>',
  chevL: '<path d="m14.5 6-6 6 6 6"/>', chevR: '<path d="m9.5 6 6 6-6 6"/>', chevD: '<path d="m6 9.5 6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  share: '<path d="M12 3.5v12M7.5 8 12 3.5 16.5 8"/><path d="M5 13v6a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6"/>',
  flag: '<path d="M5 21V4.5M5 4.5h11l-2 4 2 4H5"/>',
  star: '<path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.6-5 2.6.9-5.6-4-4 5.6-.8z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 6a9 9 0 0 1 1.4-.1C18 5.9 21.5 12 21.5 12a17 17 0 0 1-3 3.6M6.4 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  logout: '<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  shield: '<path d="M12 3.5 19.5 6v5.6c0 4.6-3.2 7.8-7.5 9-4.3-1.2-7.5-4.4-7.5-9V6z"/><path d="m8.8 12 2.2 2.2 4.3-4.4"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4M12 16.8v.1"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2.5h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.5"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>', sort: '<path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18.5 14.8c1.7.8 2.7 2.5 3 5.2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5z"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L19.5 9"/><path d="M19.5 4v5h-5"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>', tag: '<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9z"/><circle cx="8.5" cy="8.5" r="1.5"/>',
  layers: '<path d="m12 3.5 8.5 4.5L12 12.5 3.5 8z"/><path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5"/>',
  doc: '<path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20z"/><path d="M14 3.5V8h4M9 12h6M9 15.5h6"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
  // أيقونات الأقسام
  car: '<path d="M4.5 16.5V12l1.7-4.4A2 2 0 0 1 8.1 6.3h7.8a2 2 0 0 1 1.9 1.3l1.7 4.4v4.5"/><path d="M3.5 12h17v4.5h-17z"/><path d="M5.5 16.5v2M18.5 16.5v2"/><circle cx="7.5" cy="14.2" r=".9" fill="currentColor"/><circle cx="16.5" cy="14.2" r=".9" fill="currentColor"/>',
  building: '<path d="M4 20.5V6.5l7-3v17M11 8.5l9 3v9"/><path d="M3 20.5h18M7 9h1M7 12h1M7 15h1M14.5 13.5h1.5M14.5 16.5h1.5"/>',
  phone: '<rect x="6.5" y="2.8" width="11" height="18.4" rx="2.6"/><path d="M10.5 5.6h3M11 18h2"/>',
  laptop: '<rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M2.5 18.5h19l-1.5-3.5H4z"/>',
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9 8.5 6.5H6.5M15 9l-1.5-2.5H16"/><path d="m10 9 3 7"/>',
  boat: '<path d="M3 16.5h18l-2.5 4h-13z"/><path d="M12 3.5v13M12 4.5l6 9.5h-6M12 7l-5 7h5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5"/><circle cx="12" cy="12" r="6.6"/>',
  sofa: '<path d="M5 11V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5V11"/><path d="M3 12.5a2 2 0 0 1 4 0V14h10v-1.5a2 2 0 0 1 4 0V18H3z"/><path d="M5 18v2M19 18v2"/>',
  paw: '<circle cx="7" cy="10" r="1.8"/><circle cx="10.2" cy="6.2" r="1.8"/><circle cx="13.8" cy="6.2" r="1.8"/><circle cx="17" cy="10" r="1.8"/><path d="M12 11.5c-2.6 0-5 3.2-5 5.6 0 1.6 1.2 2.4 2.6 2.4 1 0 1.6-.6 2.4-.6s1.4.6 2.4.6c1.4 0 2.6-.8 2.6-2.4 0-2.4-2.4-5.6-5-5.6z"/>',
  briefcase: '<rect x="3.5" y="7" width="17" height="12.5" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17M11 12.5v1.5h2v-1.5"/>',
  tools: '<path d="M14.5 4a4.5 4.5 0 0 0-4.2 6.1L4 16.4 7.6 20l6.3-6.3A4.5 4.5 0 0 0 20 9.5l-2.8 2.8-3-.5-.5-3L16.5 6A4.5 4.5 0 0 0 14.5 4z"/>',
  box: '<path d="m12 3.5 8 4v9l-8 4-8-4v-9z"/><path d="m4 7.5 8 4 8-4M12 11.5v9"/>',
  misc: '<circle cx="6.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="17.5" cy="12" r="1.6"/>',
  bird: '<path d="M16 7.5a2.5 2.5 0 1 0-5 0c0 4-4 5.5-7.5 6 1.5 3.5 4.7 5 8 5 4 0 7-3 7-7v-2.5l2-1.5h-2.5"/><path d="M15.2 7h.1"/>',
};
export const ICONS = Object.keys(P);
export const CAT_ICONS = ['car', 'building', 'phone', 'laptop', 'bike', 'boat', 'gear', 'sofa', 'paw', 'bird', 'briefcase', 'tools', 'box', 'misc', 'tag', 'camera', 'home'];
export const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.box}</svg>`;

/* ---------------- عناصر واجهة ---------------- */
export function toast(msg, kind = '') {
  let w = $('#toasts'); if (!w) { w = document.createElement('div'); w.id = 'toasts'; w.setAttribute('aria-live', 'polite'); document.body.appendChild(w); }
  const o = document.createElement('div'); o.className = 'toast ' + kind; o.textContent = msg; w.appendChild(o);
  requestAnimationFrame(() => o.classList.add('in'));
  setTimeout(() => { o.classList.remove('in'); setTimeout(() => o.remove(), 300); }, 3200);
}
let sheetStack = 0;
/** ورقة سفلية (Bottom Sheet) */
export function sheet(html, { onOpen, cls = '', onClose } = {}) {
  closeSheet(true, true);
  const bg = document.createElement('div'); bg.className = 'sheet-bg'; bg.id = 'sheetBg';
  bg.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  bg._onClose = onClose;
  document.body.appendChild(bg); document.body.classList.add('noscroll');
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) closeSheet(); });
  requestAnimationFrame(() => bg.classList.add('in'));
  const sh = bg.firstElementChild;
  let y0 = null, dy = 0;
  sh.addEventListener('touchstart', e => { if (sh.scrollTop > 0 || e.target.closest('input,textarea,select,.hscroll')) return; y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
  sh.addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
  sh.addEventListener('touchend', () => { if (y0 == null) return; y0 = null; sh.style.transform = ''; if (dy > 110) closeSheet(); });
  if (!ignorePop && !(history.state && history.state.sheet)) { sheetStack++; history.pushState({ sheet: sheetStack }, ''); }
  if (onOpen) onOpen(sh);
  return sh;
}
export function closeSheet(now, fromPop) {
  const bg = $('#sheetBg'); if (!bg) return;
  document.body.classList.remove('noscroll');
  if (bg._onClose) try { bg._onClose(); } catch (_) { }
  bg.id = '';
  if (!fromPop && history.state && history.state.sheet) { ignorePop = true; history.back(); }
  if (now) return bg.remove();
  bg.classList.remove('in'); setTimeout(() => bg.remove(), 240);
}
let ignorePop = false;
addEventListener('popstate', e => {
  if (ignorePop) { ignorePop = false; e.stopImmediatePropagation(); if ($('#sheetBg')) { sheetStack++; history.pushState({ sheet: sheetStack }, ''); } return; }
  if ($('#sheetBg')) { closeSheet(false, true); e.stopImmediatePropagation(); }
}, true);
export function confirmBox(msg, { ok = t('confirm'), danger = false } = {}) {
  return new Promise(res => {
    let done = false;
    const fin = v => { if (done) return; done = true; closeSheet(); res(v); };
    sheet(`<div class="sheet-body"><p class="confirm-msg">${esc(msg)}</p><div class="row2"><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button><button class="btn ghost" data-no>${esc(t('cancel'))}</button></div></div>`, {
      onOpen: s => { s.querySelector('[data-ok]').onclick = () => fin(true); s.querySelector('[data-no]').onclick = () => fin(false); },
      onClose: () => { if (!done) { done = true; res(false); } },
    });
  });
}
export function promptBox(title, { placeholder = '', value = '', ok = t('confirm'), multiline = false } = {}) {
  return new Promise(res => {
    let done = false;
    const fin = v => { if (done) return; done = true; closeSheet(); res(v); };
    sheet(`<div class="sheet-body"><h3 class="sh-title">${esc(title)}</h3>${multiline ? `<textarea class="inp" rows="3" data-v placeholder="${esc(placeholder)}">${esc(value)}</textarea>` : `<input class="inp" data-v placeholder="${esc(placeholder)}" value="${esc(value)}">`}<div class="row2" style="margin-top:14px"><button class="btn primary" data-ok>${esc(ok)}</button><button class="btn ghost" data-no>${esc(t('cancel'))}</button></div></div>`, {
      onOpen: s => { const i = s.querySelector('[data-v]'); setTimeout(() => i.focus(), 200); s.querySelector('[data-ok]').onclick = () => fin(i.value.trim()); s.querySelector('[data-no]').onclick = () => fin(null); },
      onClose: () => { if (!done) { done = true; res(null); } },
    });
  });
}
/** يربط زر بحالة تحميل ويمنع الضغط المزدوج */
export async function busy(btn, fn, label) {
  if (btn && btn.dataset.busy) return;
  const old = btn ? btn.innerHTML : '';
  if (btn) { btn.dataset.busy = '1'; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${esc(label || t('loading'))}`; }
  try { return await fn(); }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = old; delete btn.dataset.busy; } }
}
