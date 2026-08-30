// public/sw.js
// Service Worker بسيط ومقصود:
//   - الملفات الثابتة: cache-first مع تحديث في الخلفية.
//   - أي حاجة تحت /api/ أو Firebase: من النت دايمًا، ومفيش كاش خالص
//     (رسايل وتوكنات ماينفعش تتكاش).
//   - لو النت قاطع وفتحت التطبيق: بنرجّع index.html من الكاش.
const VERSION = 'malg-v2';
const SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/js/phone.js',
  '/js/format.js',
  '/js/paths.js',
  '/js/app.js',
  '/firebase-client-config.js',
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

  // صفحات: من النت الأول، والكاش احتياطي لو مفيش نت
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || Response.error()))
    );
    return;
  }

  // ملفات: من الكاش الأول، وبنحدّثها في الخلفية
  event.respondWith(
    caches.match(request).then((hit) => {
      const fresh = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit || Response.error());
      return hit || fresh;
    })
  );
});
