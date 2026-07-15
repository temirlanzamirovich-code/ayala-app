// sw.js — Service Worker для Ayala PWA
const CACHE_NAME = 'ayala-v3';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon.png'];

// Установка: кешируем файлы по отдельности — один недоступный файл
// больше не рушит установку целиком
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

// Активация: удаляем старые версии кеша (в т.ч. залипший ayala-v2)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Сам сайт (HTML/навигация) — network-first: всегда берём свежую версию из сети,
  // чтобы обновления появлялись сразу. Кеш — только запасной вариант для офлайна.
  const isHTML =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() =>
          caches.match(request).then((c) => c || caches.match('./index.html'))
        )
    );
    return;
  }

  // Остальные файлы (иконка, манифест и пр.) — cache-first
  event.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => cached)
    )
  );
});
