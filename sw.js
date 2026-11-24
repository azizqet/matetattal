// ماتعطل v5 — Service Worker
// يخزّن ملفات الواجهة الثابتة فقط. لا يخزّن طلبات الخادم (Supabase) أو بيانات الحساب أو لوحة الإدارة.
const VERSION = 'm5-v5.0.1';
const SHELL = ['./', './index.html', './css/app.css?v=5.0.0', './js/app.js?v=5.0.1', './js/i18n.js', './js/core.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/favicon.svg', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.headers.get('authorization')) return;
  if (url.origin !== self.location.origin && !FONT_HOSTS.includes(url.hostname)) return;
  if (url.origin === self.location.origin && /admin/i.test(url.pathname)) return;
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(VERSION + '-fonts').then(async c => { const hit = await c.match(req); if (hit) return hit; const r = await fetch(req); if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', cp)); } return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  // الشبكة أولاً لملفات الواجهة حتى تصل التحديثات فوراً، والتخزين احتياط عند انقطاع الإنترنت
  e.respondWith(fetch(req).then(r => { if (r.ok && r.type === 'basic') { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); } return r; }).catch(() => caches.match(req)));
});
