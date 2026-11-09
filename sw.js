// Cache de l'appli pour qu'elle marche hors-ligne. À chaque mise à jour : changer VERSION ici
// et le ?v= de style.css et app.js dans index.html (sinon un téléphone peut mélanger deux versions).
const VERSION = 'eclair-v11';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'img/content.webp', 'img/pascontent.webp', 'img/caca-content.svg', 'img/caca-pascontent.svg', 'img/anneau-content.svg', 'img/anneau-pascontent.svg', 'img/sabre-content.svg', 'img/sabre-pascontent.svg', 'img/baguette-content.svg', 'img/baguette-pascontent.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Réseau d'abord (pour recevoir les mises à jour), cache si hors-ligne.
// cache: 'no-cache' : on revalide toujours auprès du serveur, sinon le cache HTTP du navigateur
// (10 min sur GitHub Pages) peut servir un ancien app.js avec un nouvel index.html.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
