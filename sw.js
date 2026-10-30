// Service worker Takaata : l'app s'ouvre même sans réseau (coque mise en cache).
const CACHE = 'takaata-v9';
const SHELL = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/data.js', './js/i18n.js', './js/store.js', './js/ui.js', './js/vehicles.js', './js/site.js', './js/media.js', './js/app.js',
  './icons/icon.svg',
  './assets/vehicles/tricycle.jpg', './assets/vehicles/truck3t.jpg', './assets/vehicles/truck10t-goods.jpg', './assets/vehicles/truck10t-moving.jpg', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Réseau d'abord pour les pages et scripts (mises à jour rapides), cache en secours.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

// Clic sur une notification chauffeur : « Accepter » envoie l'offre, « Voir » ouvre l'app.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const msg = { type: 'tk-notif', action: e.action || 'open', orderId: data.orderId || null };
    if (list.length) { list[0].postMessage(msg); return list[0].focus(); }
    return self.clients.openWindow('./#chauffeur');
  }));
});
