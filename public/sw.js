// public/sw.js
// Service Worker بسيط ومقصود:
//   - كل حاجة: من النت الأول (network-first)، والكاش احتياطي بس لو النت مقطوع.
//     ده أهم من سرعة الفتح شوية، عشان لما ننشر تحديث جديد على الموقع محدش
//     يفضل شغال بنسخة قديمة من style.css أو app.js متزنقة مع HTML جديد
//     (اللي بيسبب شكل تايه/متراكب ومقاسات غلط لحد ما يعمل Hard Refresh).
//   - أي حاجة تحت /api/ أو Firebase: من النت دايمًا، ومفيش كاش خالص.
//   - أول ما نسخة جديدة من الـ Service Worker تتفعّل، بنعمل رفرش تلقائي
//     لأي تابات مفتوحة عشان محدش يحتاج يعمل حاجة يدوي.
const VERSION = 'malg-v4';
const SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/js/phone.js',
  '/js/format.js',
  '/js/paths.js',
  '/js/store.js',
  '/js/app.js',
  '/firebase-client-config.js',
  '/cloudinary-client-config.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((c) => { try { c.navigate(c.url); } catch (_) { /* بعض المتصفحات بترفض، مش مشكلة */ } }))
  );
});

function isCacheable(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false; // Firebase SDK وغيره
  if (url.pathname.startsWith('/api/')) return false;
  return true;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (!isCacheable(request)) {
    return; // سيبها للمتصفح — من النت على طول
  }

  // network-first لكل حاجة: لو النت شغال بيجيب أحدث نسخة ويحدّث الكاش،
  // ولو مقطوع بيرجع آخر نسخة متكاشة (أو index.html للصفحات).
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(request).then((hit) => {
        if (hit) return hit;
        if (request.mode === 'navigate') return caches.match('/index.html').then((r) => r || Response.error());
        return Response.error();
      }))
  );
});
