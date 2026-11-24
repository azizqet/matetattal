// ماتعطل — Service Worker آمن
// يخزّن ملفات الواجهة الثابتة فقط. لا يخزّن أي طلبات للخادم (Supabase) أو بيانات الحساب أو لوحة الإدارة.
const VERSION = 'm3-v4.7.0';
const SHELL = ['./', './index.html', './css/app.css?v=4.7.0', './js/core.js', './js/app.js?v=4.7.0', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/favicon.svg', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k.startsWith('m3-')).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // لا نتدخل أبداً في: الخادم، المصادقة، الصور المرفوعة، الخرائط، لوحة الإدارة، أو أي طلب يحمل Authorization
  if (req.headers.get('authorization')) return;
  if (url.origin !== self.location.origin && !FONT_HOSTS.includes(url.hostname)) return;
  if (url.origin === self.location.origin && /admin/i.test(url.pathname)) return;
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(VERSION + '-fonts').then(async c => { const hit = await c.match(req); if (hit) return hit; const r = await fetch(req); if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { if (r.ok) caches.open(VERSION).then(c => c.put('./index.html', r.clone())); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req);
    const net = fetch(req).then(r => { if (r.ok && r.type === 'basic') c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
