// شبكة أمان: إذا ما اشتغل التطبيق خلال ثوانٍ (غالباً بسبب نسخة قديمة مخزنة في الجهاز)
// نحذف الكاش القديم ونلغي الـ Service Worker ونعيد التحميل مرة وحدة فقط.
(function () {
  var KEY = 'm5_rescued';
  setTimeout(function () {
    if (!document.getElementById('splash') || window.__m5ok) return;
    var done = false; try { done = sessionStorage.getItem(KEY) === '1'; } catch (e) { }
    if (done) {
      var s = document.getElementById('splash');
      if (s && !s.querySelector('button')) {
        var b = document.createElement('button');
        b.textContent = 'إعادة التحميل';
        b.style.cssText = 'margin-top:18px;padding:12px 22px;border:0;border-radius:12px;background:#fff;color:#1a44c2;font:700 16px Tajawal,system-ui,sans-serif';
        b.onclick = function () { location.reload(); };
        s.firstElementChild.appendChild(b);
      }
      return;
    }
    try { sessionStorage.setItem(KEY, '1'); } catch (e) { }
    var jobs = [];
    if ('serviceWorker' in navigator) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }).catch(function () { }));
    if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }).catch(function () { }));
    Promise.all(jobs).then(function () { location.reload(); });
  }, 7000);
})();
