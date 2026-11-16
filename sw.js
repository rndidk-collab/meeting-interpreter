// Service worker for the installed app: makes it installable and lets the screen open on a
// weak connection. The page is fetched network-first so a deploy shows up on the next open;
// the cached copy is only a fallback. API calls (other origins) are never touched.
// Bump the stamp with every deploy: a new cache name is what makes the new worker install.
// Keep it in step with APP_VERSION in index.html (2026-11-16-2).
const CACHE = 'bmt-20261116211000';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('bmt-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    const cached = () => caches.match('./index.html').then(r => r || caches.match('./'));
    e.respondWith(
      // no-cache: revalidate with the server so the browser's HTTP cache can't serve last
      // deploy's HTML; the Cache Storage copy is only for offline / server errors.
      fetch(req, { cache: 'no-cache' })
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            e.waitUntil(caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {}));
            return res;
          }
          return res.status >= 500 ? cached().then(r => r || res) : res;
        })
        .catch(cached)
    );
    return;
  }

  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
