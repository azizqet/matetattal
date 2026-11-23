// ماتعطل — الوحدة المشتركة (واجهة الخادم، الحسابات، الأيقونات، أدوات الواجهة)
// ملاحظة أمنية: المفتاح أدناه هو المفتاح العام (publishable) فقط. الصلاحيات الفعلية تُطبَّق في الخادم عبر RLS.
export const CFG = {
  url: 'https://xpnwhvbxordtsmnegvri.supabase.co',
  key: 'sb_publishable_n7zs9ZZSp98MURnnpu3UAw_-OhKNHH9',
  supportWa: '96565755222',
  storagePrefix: 'https://xpnwhvbxordtsmnegvri.supabase.co/storage/v1/object/public/',
};

/* ---------------- أدوات عامة ---------------- */
export const esc = s => String(s == null ? '' : s).replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export const digits = s => String(s || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
/** رقم كويتي محلي من 8 أرقام أو '' */
export function localPhone(s) { let d = digits(s); if (d.length === 11 && d.startsWith('965')) d = d.slice(3); if (d.length === 12 && d.startsWith('00965')) d = d.slice(5); return /^[2569]\d{7}$/.test(d) ? d : ''; }
export const intlPhone = p => { const d = digits(p); return d.length === 8 ? '965' + d : d; };
export const rnd = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
/** يسمح فقط بروابط صور https (تمنع javascript: و data: الغريبة) */
export const safeImg = u => (typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u)) ? u : '';
export const fmtDate = s => { if (!s) return '—'; try { return new Date(/^\d{4}-\d\d-\d\d$/.test(s) ? s + 'T12:00:00' : s).toLocaleDateString('ar-KW-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (_) { return String(s).slice(0, 10); } };
export const fmtNum = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
/** تطبيع النص العربي للبحث */
export const norm = s => String(s || '').toLowerCase().replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/\s+/g, ' ').trim();
export const store = {
  get(k, d = null) { try { const v = localStorage.getItem('m3_' + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem('m3_' + k, JSON.stringify(v)); } catch (_) { } },
  del(k) { try { localStorage.removeItem('m3_' + k); } catch (_) { } },
};

/* ---------------- رسائل الأخطاء بالعربي ---------------- */
export function errText(e) {
  const m = String((e && (e.message || e.msg)) || e || '');
  const map = [
    [/phone already registered/i, 'هذا الرقم مسجّل مسبقاً. سجّل الدخول أو استخدم «نسيت كلمة السر».'],
    [/weak password/i, 'كلمة السر لازم تكون 8 خانات على الأقل وتحتوي أرقام وحروف.'],
    [/invalid phone/i, 'اكتب رقم هاتف كويتي صحيح من 8 أرقام.'],
    [/invalid_credentials|Invalid login/i, 'رقم الهاتف أو كلمة السر غير صحيحة.'],
    [/rate limit|too many/i, 'محاولات كثيرة. حاول مرة ثانية بعد قليل.'],
    [/Email not confirmed/i, 'هذا الحساب يحتاج تفعيل من الإدارة. تواصل مع الدعم.'],
    [/JWT expired|invalid JWT|session/i, 'انتهت الجلسة. سجّل الدخول من جديد.'],
    [/row-level security|permission denied|forbidden|42501/i, 'ما عندك صلاحية لهذا الإجراء.'],
    [/invalid image|mime|Payload too large|413/i, 'الصورة غير صالحة أو حجمها كبير.'],
    [/reject reason required/i, 'اكتب سبب الرفض.'],
    [/cannot review own/i, 'ما تقدر تقيّم نشاطك.'],
    [/net|Failed to fetch|NetworkError/i, 'تعذّر الاتصال. تأكد من الإنترنت وحاول مرة ثانية.'],
  ];
  for (const [r, t] of map) if (r.test(m)) return t;
  return 'صار خطأ غير متوقع' + (m ? ' (' + m.slice(0, 120) + ')' : '');
}

/* ---------------- الجلسة ---------------- */
let SES = null, sesStore = 'local';
const SKEY = 'm3_session';
const readSes = () => { try { return JSON.parse((sesStore === 'local' ? localStorage : sessionStorage).getItem(SKEY)); } catch (_) { return null; } };
function writeSes(s) {
  SES = s;
  try { const st = sesStore === 'local' ? localStorage : sessionStorage; s ? st.setItem(SKEY, JSON.stringify(s)) : st.removeItem(SKEY); } catch (_) { }
  authListeners.forEach(f => { try { f(s); } catch (_) { } });
}
const authListeners = new Set();
export const onAuth = f => authListeners.add(f);
export function initSession(mode = 'local') { sesStore = mode; SES = readSes(); return SES; }
export const session = () => SES;
const mkSes = j => ({ at: j.access_token, rt: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000, uid: j.user && j.user.id, email: (j.user && j.user.email) || '' });

let refreshing = null;
export async function token() {
  if (!SES) return null;
  if (Date.now() < SES.exp - 60000) return SES.at;
  if (!refreshing) refreshing = (async () => {
    try { const j = await raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: SES.rt }, anon: true }); writeSes(mkSes(j)); return SES.at; }
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
  if (o.prefer) h.Prefer = o.prefer;
  if (o.headers) Object.assign(h, o.headers);
  let r;
  try { r = await fetch(CFG.url + path, { method: o.method || 'GET', headers: h, body: o.body === undefined ? undefined : JSON.stringify(o.body), cache: 'no-store' }); }
  catch (_) { const x = new Error('Failed to fetch'); x.net = true; throw x; }
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (_) { }
  if (!r.ok) { const x = new Error((j && (j.message || j.msg || j.error_description || j.error_code || j.error)) || ('HTTP ' + r.status)); x.status = r.status; x.code = j && j.code; throw x; }
  return j;
}
/** طلب للخادم؛ يرفق توكن المستخدم تلقائياً إن وُجد */
export async function api(path, o = {}) {
  const tok = o.anon ? null : await token().catch(() => null);
  return raw(path, Object.assign({}, o, { tok }));
}
export const rpc = (fn, args = {}, o = {}) => api('/rest/v1/rpc/' + fn, Object.assign({ method: 'POST', body: args }, o));
export const rest = (q, o) => api('/rest/v1/' + q, o);

/* ---------------- الحسابات ---------------- */
export const phoneEmail = p => '965' + p + '@users.matattal.invalid';
export async function login(identifier, password) {
  const id = String(identifier || '').trim();
  let email;
  if (id.includes('@')) email = id.toLowerCase();
  else { const p = localPhone(id); if (!p) throw new Error('invalid phone'); email = phoneEmail(p); }
  const j = await raw('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, anon: true });
  writeSes(mkSes(j));
  return SES;
}
export async function register(phone, password, name) {
  const p = localPhone(phone); if (!p || /^2/.test(p)) throw new Error('invalid phone');
  await raw('/rest/v1/rpc/register_account', { method: 'POST', body: { p_phone: p, p_password: password, p_name: name || null } });
  return login(p, password);
}
export async function logout() {
  const t = SES && SES.at;
  writeSes(null);
  if (t) { try { await raw('/auth/v1/logout', { method: 'POST', tok: t }); } catch (_) { } }
}
export async function myProfile() {
  if (!SES) return null;
  const r = await rest('profiles?select=id,full_name,phone,role,created_at&id=eq.' + encodeURIComponent(SES.uid));
  return (r && r[0]) || null;
}

/* ---------------- رفع الصور ---------------- */
export function shrinkImage(file, max = 1200, q = 0.84) {
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
export async function upload(bucket, path, blob) {
  const tok = await token();
  if (!tok) throw new Error('session');
  let r;
  try { r = await fetch(CFG.url + '/storage/v1/object/' + bucket + '/' + path, { method: 'POST', headers: { apikey: CFG.key, Authorization: 'Bearer ' + tok, 'Content-Type': 'image/jpeg', 'cache-control': 'max-age=31536000', 'x-upsert': 'false' }, body: blob }); }
  catch (_) { throw new Error('Failed to fetch'); }
  if (!r.ok) { let m = ''; try { const j = await r.json(); m = j.message || j.error || ''; } catch (_) { } throw new Error(m || ('HTTP ' + r.status)); }
  return CFG.storagePrefix + bucket + '/' + path;
}

/* ---------------- الأيقونات (مجموعة موحّدة، خط 1.8) ---------------- */
const P = {
  home: '<path d="M3.5 10.5 12 3.8l8.5 6.7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  map: '<path d="m9 4-6 2.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  phone: '<path d="M5 3.5h3.2l1.6 4.2-2.2 1.5a11 11 0 0 0 7.2 7.2l1.5-2.2 4.2 1.6V19a1.5 1.5 0 0 1-1.6 1.5C10.4 20 4 13.6 3.5 5.1A1.5 1.5 0 0 1 5 3.5z"/>',
  wa: '<path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.4-4.2a8.5 8.5 0 1 1 15.6-4.6z"/><path d="M8.7 8.6c.2-.6.6-.7 1-.7h.5c.2 0 .4.1.5.4l.7 1.6c.1.3 0 .5-.1.7l-.5.6c-.1.2-.1.3 0 .5a6 6 0 0 0 2.6 2.4c.2.1.4.1.5-.1l.6-.7c.2-.2.4-.2.7-.1l1.5.7c.3.1.4.3.4.5 0 .5-.2 1.2-.8 1.5-.6.4-1.5.5-2.8 0a9.3 9.3 0 0 1-4.6-4.4c-.6-1.2-.5-2.2-.2-2.9z" fill="currentColor" stroke="none"/>',
  chevL: '<path d="m14.5 6-6 6 6 6"/>', chevR: '<path d="m9.5 6 6 6-6 6"/>', chevD: '<path d="m6 9.5 6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  share: '<path d="M12 3.5v12M7.5 8 12 3.5 16.5 8"/><path d="M5 13v6a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6"/>',
  star: '<path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.6-5 2.6.9-5.6-4-4 5.6-.8z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  megaphone: '<path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  store: '<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 11.5V20h13v-8.5M10 20v-5h4v5"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  logout: '<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  key2: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2"/>',
  shieldc: '<path d="M12 3.5 19.5 6v5.6c0 4.6-3.2 7.8-7.5 9-4.3-1.2-7.5-4.4-7.5-9V6z"/><path d="m8.8 12 2.2 2.2 4.3-4.4"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4M12 16.8v.1"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>', sort: '<path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18.5 14.8c1.7.8 2.7 2.5 3 5.2"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
  layers: '<path d="m12 3.5 8.5 4.5L12 12.5 3.5 8z"/><path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5"/>',
  pause: '<path d="M9 5.5v13M15 5.5v13"/>', play: '<path d="M7.5 5v14l11-7z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  tap: '<path d="M9 11.5V5.5a1.8 1.8 0 0 1 3.6 0V11l4.6.9c1 .2 1.7 1 1.6 2.1l-.6 4.5a2.5 2.5 0 0 1-2.5 2H11a3 3 0 0 1-2.3-1.1L5.5 15.5a1.6 1.6 0 0 1 2.3-2.2z"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L19.5 9"/><path d="M19.5 4v5h-5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  siren: '<path d="M5 19v-4.5l1.6-3.6A2 2 0 0 1 8.4 9.7h7.2a2 2 0 0 1 1.8 1.2l1.6 3.6V19"/><path d="M4 19h16M7.5 15.5h.01M16.5 15.5h.01"/><path d="M12 6.5V4M7.2 7.6 5.8 6.2M16.8 7.6l1.4-1.4"/>',
  // أيقونات الخدمات (نفس أسلوب تطبيق ماتعطل)
  carKey: '<path d="M4.5 20v-4l1.5-3.3A2 2 0 0 1 7.8 11.5h8.4a2 2 0 0 1 1.8 1.2l1.5 3.3v4"/><path d="M4 20h16M8 17h.01M16 17h.01"/><circle cx="9" cy="5.5" r="2"/><path d="M11 5.5h6M15 5.5v2M17 5.5v1.5"/>',
  carWash: '<path d="M4.5 20v-4l1.5-3.3A2 2 0 0 1 7.8 11.5h8.4a2 2 0 0 1 1.8 1.2l1.5 3.3v4"/><path d="M4 20h16M8 17h.01M16 17h.01"/><path d="M8 4.5v1.5M12 3.5v2M16 4.5v1.5"/>',
  carShield: '<path d="M12 3 19.5 5.6v5.7c0 4.6-3.2 7.9-7.5 9.2-4.3-1.3-7.5-4.6-7.5-9.2V5.6z"/><path d="M8.5 14v-1.8l.8-1.7a1 1 0 0 1 .9-.5h3.6a1 1 0 0 1 .9.5l.8 1.7V14M8.2 14h7.6"/>',
  batt: '<rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M7 7.5V5.5M17 7.5V5.5M6.5 13.5h4M8.5 11.5v4M14 13.5h4"/>',
  carWrench: '<path d="M3.5 19v-3.5l1.4-3A2 2 0 0 1 6.7 11.3h6.8"/><path d="M3 19h9M7 16.5h.01"/><path d="M19.8 9.6a3.3 3.3 0 0 1-4.3 3.9l-3.4 3.4a1.3 1.3 0 0 1-1.8-1.8l3.4-3.4a3.3 3.3 0 0 1 3.9-4.3l-1.9 1.9.4 1.4 1.4.4z"/>',
  towTruck: '<path d="M2.5 16.5V9.5h9.5v7"/><path d="M12 11.5h4.2l3.3 3.2v1.8H18"/><circle cx="6.5" cy="17" r="2"/><circle cx="16" cy="17" r="2"/><path d="M8.5 16.5h5.5M2.5 12.5h4l1.5-3"/>',
  tireRing: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><path d="M12 3.5V8M12 16v4.5M3.5 12H8M16 12h4.5"/>',
  // أيقونات الخدمات
  tow: '<path d="M2.5 16.5V12l2-4h6v8.5"/><path d="M10.5 16.5h3M10.5 10h5l3 3.5h3v3h-1.5"/><circle cx="6.5" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M4.5 8 9 3.5l1.5 1.5"/>',
  tire: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v5.3M12 15.2v5.3M3.5 12h5.3M15.2 12h5.3"/>',
  key: '<circle cx="7.5" cy="15.5" r="4"/><path d="m10.5 12.5 8-8M15.5 7.5l2.5 2.5M13.5 9.5l1.8 1.8"/>',
  wash: '<path d="M12 3s5.5 6 5.5 10a5.5 5.5 0 0 1-11 0C6.5 9 12 3 12 3z"/><path d="M9.5 13.5a2.5 2.5 0 0 0 2.5 2.5"/><path d="M19 3.5v3M17.5 5h3"/>',
  shield: '<path d="M12 3.5 19.5 6v5.6c0 4.6-3.2 7.8-7.5 9-4.3-1.2-7.5-4.4-7.5-9V6z"/><path d="M12 7.5v9M8.5 11.5h7"/>',
  battery: '<rect x="3" y="7.5" width="16" height="10" rx="2"/><path d="M21 11v3"/><path d="m11.5 9.5-2.5 3.5h3.5l-2.5 3.5"/>',
  wrench: '<path d="M14.5 4a4.5 4.5 0 0 0-4.2 6.1L4 16.4 7.6 20l6.3-6.3A4.5 4.5 0 0 0 20 9.5l-2.8 2.8-3-.5-.5-3L16.5 6A4.5 4.5 0 0 0 14.5 4z"/>',
  car: '<path d="M4 15.5V12l1.8-4.6A2 2 0 0 1 7.7 6h8.6a2 2 0 0 1 1.9 1.4L20 12v3.5"/><path d="M3 15.5h18v2.5H3zM4 12h16"/><circle cx="7.5" cy="15" r="0.6"/><circle cx="16.5" cy="15" r="0.6"/><path d="M5 18v2M19 18v2"/>',
};
const SVC_ICON = { tow: 'towTruck', tire: 'tireRing', keys: 'carKey', key: 'carKey', wash: 'carWash', shield: 'carShield', bat: 'batt', battery: 'batt', mech: 'carWrench', wrench: 'carWrench', other: 'grid', grid: 'grid' };
export const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.info}</svg>`;
export const svcIcon = s => icon(SVC_ICON[(s && (s.icon || s.id)) || s] || SVC_ICON[s && s.id] || 'car');

/* ---------------- عناصر واجهة ---------------- */
export function toast(t, kind = '') {
  let w = $('#toasts'); if (!w) { w = document.createElement('div'); w.id = 'toasts'; w.setAttribute('aria-live', 'polite'); document.body.appendChild(w); }
  const o = document.createElement('div'); o.className = 'toast ' + kind; o.textContent = t; w.appendChild(o);
  requestAnimationFrame(() => o.classList.add('in'));
  setTimeout(() => { o.classList.remove('in'); setTimeout(() => o.remove(), 300); }, 3400);
}
/** ورقة سفلية (Bottom Sheet) */
export function sheet(html, { onOpen, cls = '' } = {}) {
  closeSheet(true);
  const bg = document.createElement('div'); bg.className = 'sheet-bg'; bg.id = 'sheetBg';
  bg.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  document.body.appendChild(bg); document.body.classList.add('noscroll');
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) closeSheet(); });
  requestAnimationFrame(() => bg.classList.add('in'));
  const sh = bg.firstElementChild;
  // سحب للإغلاق
  let y0 = null, dy = 0;
  sh.addEventListener('touchstart', e => { if (sh.scrollTop > 0) return; y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
  sh.addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
  sh.addEventListener('touchend', () => { if (y0 == null) return; y0 = null; sh.style.transform = ''; if (dy > 110) closeSheet(); });
  if (onOpen) onOpen(sh);
  return sh;
}
export function closeSheet(now) {
  const bg = $('#sheetBg'); if (!bg) return;
  document.body.classList.remove('noscroll');
  if (now) return bg.remove();
  bg.classList.remove('in'); setTimeout(() => bg.remove(), 260);
}
export function confirmBox(msg, { ok = 'تأكيد', danger = false } = {}) {
  return new Promise(res => {
    let done = false; const fin = v => { if (done) return; done = true; closeSheet(); res(v); };
    sheet(`<div class="sheet-body"><p class="confirm-msg">${esc(msg)}</p><div class="row2"><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button><button class="btn ghost" data-no>إلغاء</button></div></div>`, {
      onOpen: s => { s.querySelector('[data-ok]').onclick = () => fin(true); s.querySelector('[data-no]').onclick = () => fin(false); }
    });
    const bg = $('#sheetBg'); bg && bg.addEventListener('click', e => { if (e.target === bg) fin(false); });
  });
}
/** يربط زر بحالة تحميل ويمنع الضغط المزدوج */
export async function busy(btn, fn, label = 'جاري التنفيذ...') {
  if (btn && btn.dataset.busy) return;
  const old = btn ? btn.innerHTML : '';
  if (btn) { btn.dataset.busy = '1'; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${esc(label)}`; }
  try { return await fn(); }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = old; delete btn.dataset.busy; } }
}

/* ---------------- الخريطة (تحميل كسول لـ Leaflet) ---------------- */
let leafletP = null;
export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletP) return leafletP;
  leafletP = new Promise((res, rej) => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    l.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='; l.crossOrigin = ''; document.head.appendChild(l);
    const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='; s.crossOrigin = '';
    s.onload = () => res(window.L); s.onerror = () => { leafletP = null; rej(new Error('Failed to fetch')); };
    document.head.appendChild(s);
  });
  return leafletP;
}
export const KW_CENTER = [29.3375, 47.9744];
export const markerIcon = L => L.divIcon({ className: 'm3-pin', html: '<span></span>', iconSize: [30, 40], iconAnchor: [15, 38] });
export const tileLayer = L => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });

/** نافذة اختيار موقع على الخريطة. ترجع {lat,lng} أو null */
export function pickOnMap(start) {
  return new Promise(async res => {
    let L; try { L = await loadLeaflet(); } catch (_) { toast('الخريطة ما تحمّلت. تأكد من الإنترنت.', 'err'); return res(null); }
    const o = document.createElement('div'); o.className = 'mapov'; o.innerHTML = `
      <div class="mapov-top"><button class="icon-btn" data-x aria-label="إغلاق">${icon('close')}</button><b>اضغط على الخريطة لتحديد الموقع</b><span></span></div>
      <div class="mapov-map" dir="ltr"></div>
      <div class="mapov-bar"><button class="btn ghost" data-gps>${icon('locate')}موقعي</button><button class="btn primary grow" data-ok>تأكيد الموقع</button></div>`;
    document.body.appendChild(o); document.body.classList.add('noscroll');
    const c0 = start ? [start.lat, start.lng] : KW_CENTER;
    const m = L.map(o.querySelector('.mapov-map'), { zoomControl: false, attributionControl: true }).setView(c0, start ? 15 : 10);
    tileLayer(L).addTo(m); L.control.zoom({ position: 'bottomleft' }).addTo(m);
    let mk = start ? L.marker(c0, { draggable: true, icon: markerIcon(L) }).addTo(m) : null;
    const put = ll => { if (mk) mk.setLatLng(ll); else mk = L.marker(ll, { draggable: true, icon: markerIcon(L) }).addTo(m); };
    m.on('click', e => put(e.latlng));
    setTimeout(() => m.invalidateSize(), 80);
    const end = v => { m.remove(); o.remove(); document.body.classList.remove('noscroll'); res(v); };
    o.querySelector('[data-x]').onclick = () => end(null);
    o.querySelector('[data-gps]').onclick = () => geo().then(p => { put([p.lat, p.lng]); m.setView([p.lat, p.lng], 16); }).catch(() => toast('ما قدرنا نحدد موقعك. اختر يدوياً.', 'err'));
    o.querySelector('[data-ok]').onclick = () => { if (!mk) return toast('اضغط على الخريطة أولاً'); const ll = mk.getLatLng(); end({ lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) }); };
  });
}
export const geo = () => new Promise((res, rej) => {
  if (!navigator.geolocation) return rej(new Error('nogeo'));
  navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), rej, { timeout: 9000, enableHighAccuracy: true, maximumAge: 120000 });
});
export function distKm(a, b) {
  const R = 6371, r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// إحداثيات تقريبية لمراكز المناطق المسجلة (لتحديد أقرب منطقة فقط)
export const AREA_XY = { 'العاصمة': [29.369, 47.978], 'حولي': [29.338, 48.028], 'السالمية': [29.334, 48.076], 'الفروانية': [29.277, 47.959], 'الجهراء': [29.337, 47.658], 'الأحمدي': [29.077, 48.084], 'الفحيحيل': [29.083, 48.131], 'مبارك الكبير': [29.204, 48.059] };
export function nearestArea(p, names) {
  let best = null, bd = 1e9;
  names.forEach(n => { const c = AREA_XY[n]; if (!c) return; const d = distKm(p, { lat: c[0], lng: c[1] }); if (d < bd) { bd = d; best = n; } });
  return best;
}
