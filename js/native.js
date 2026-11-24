// ماتعطل — تكامل التطبيق الأصلي (Capacitor). لا يفعل شيئاً عند التشغيل في المتصفح.
const C = window.Capacitor;
export const isNative = !!(C && C.isNativePlatform && C.isNativePlatform());
export const platform = isNative ? C.getPlatform() : 'web';
const P = n => (isNative && C.Plugins && C.Plugins[n]) || null;
export const SITE = 'https://mat3tl.com/';

/** لون شريط الحالة حسب الصفحة: أزرق مع نص فاتح للصفحات ذات الهيدر الأزرق، وأبيض مع نص داكن للباقي */
let lastHero = null;
export function statusBar(hero) {
  const sb = P('StatusBar'); if (!sb || hero === lastHero) return; lastHero = hero;
  try { sb.setStyle({ style: hero ? 'DARK' : 'LIGHT' }); if (platform === 'android') sb.setBackgroundColor({ color: hero ? '#1a44c2' : '#ffffff' }); } catch (_) { }
}
export function hideSplash() { const s = P('SplashScreen'); if (s) s.hide({ fadeOutDuration: 250 }).catch(() => { }); }
export function tap() { const h = P('Haptics'); if (h) h.impact({ style: 'LIGHT' }).catch(() => { }); }
/** مشاركة أصلية؛ ترجع false إذا غير متاحة */
export async function nativeShare(title, url) {
  const s = P('Share'); if (!s) return false;
  try { await s.share({ title, text: title, url, dialogTitle: title }); } catch (_) { }
  return true;
}
/** زر الرجوع في أندرويد: يغلق الورقة المفتوحة، أو يرجع صفحة، أو يخرج من التطبيق في الرئيسية */
export function backButton(handler) {
  const a = P('App'); if (!a) return;
  a.addListener('backButton', () => { if (!handler()) a.exitApp(); });
}
/** روابط mat3tl.com المفتوحة من خارج التطبيق (App Links / Universal Links) */
export function deepLinks(open) {
  const a = P('App'); if (!a) return;
  a.addListener('appUrlOpen', e => { try { const u = new URL(e.url); if (u.hash.startsWith('#/')) open(u.hash.slice(1)); } catch (_) { } });
}
if (isNative) document.documentElement.classList.add('native', 'native-' + platform);
