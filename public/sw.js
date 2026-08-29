// sw.js — بسيط جداً دلوقتي، بس عشان الموقع يتعرف كـ PWA (شرط أساسي عشان نعمله APK)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // مفيش تخزين مؤقت (caching) دلوقتي - كل حاجة بتتجاب لايف من السيرفر
  event.respondWith(fetch(event.request));
});
