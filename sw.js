/* ═══════════════════════════════════════════
   SERVICE WORKER — القرآن الكريم PWA
   يخزن الموقع كاملاً للعمل بدون إنترنت
═══════════════════════════════════════════ */

const CACHE_NAME = 'quran-pwa-v1';
const OFFLINE_URL = './index.html';

// الملفات التي تُحفظ فوراً عند التثبيت
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Amiri+Quran&family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700;900&display=swap',
];

// ── INSTALL: تثبيت وتخزين الملفات ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS.map(url => new Request(url, { mode: 'no-cors' })))
        .catch(() => cache.add(OFFLINE_URL));
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: تنظيف الكاش القديم ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: استراتيجية الشبكة أولاً، ثم الكاش ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // طلبات API القرآن — شبكة أولاً مع كاش احتياطي
  if (url.hostname === 'api.alquran.cloud') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // ملفات الخطوط والصوت — كاش أولاً
  if (url.hostname.includes('cdn.islamic.network') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok || response.type === 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        }).catch(() => cached || new Response('', { status: 503 }));
      })
    );
    return;
  }

  // باقي الملفات — كاش أولاً
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(OFFLINE_URL));
    })
  );
});

// ── رسالة من الصفحة: مسح الكاش ──
self.addEventListener('message', event => {
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.source.postMessage('CACHE_CLEARED');
    });
  }
});
