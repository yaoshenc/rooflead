// RoofLead offline support: keeps the app shell, scripts and recently viewed
// aerial images and photo thumbnails available without signal. Data stays in
// the browser; API requests always go to the network. Signing out clears it.
const CACHE = 'rooflead-shell-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('rooflead-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('message', (e) => {
  if (e.data?.type === 'precache' && Array.isArray(e.data.urls)) {
    e.waitUntil(caches.open(CACHE).then((c) => Promise.all(e.data.urls.slice(0, 80).map((u) => fetch(u, { credentials: 'same-origin' }).then((r) => { if (r.ok && !r.redirected) return c.put(new URL(u, self.location.origin).pathname === '/' ? '/' : u, r); }).catch(() => {})))));
  }
  if (e.data?.type === 'clear') e.waitUntil(caches.delete(CACHE));
});
const isLogin = (r) => r.redirected || new URL(r.url).pathname === '/login';
async function networkFirst(req, key) {
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok && !isLogin(res)) c.put(key || req, res.clone());
    return res;
  } catch {
    return (await c.match(key || req, { ignoreSearch: !!key })) || (await c.match('/')) || Response.error();
  }
}
async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  try { const res = await fetch(req); if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; } catch { return Response.error(); }
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (u.pathname === '/logout') { e.respondWith(caches.delete(CACHE).then(() => fetch(req))); return; }
    if (/^\/api\/photos\/[0-9a-f-]{36}$/.test(u.pathname)) { e.respondWith(cacheFirst(req)); return; }
    if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/upload/') || u.pathname === '/login' || u.pathname === '/sw.js') return;
    e.respondWith(networkFirst(req, req.mode === 'navigate' ? '/' : null));
    return;
  }
  if (/(^|\.)(maps\.six|portal\.spatial)\.nsw\.gov\.au$|^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) e.respondWith(cacheFirst(req));
});
