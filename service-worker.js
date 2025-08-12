const CACHE='wanderlust-punch-v3_2';
const ASSETS=['./','index.html','styles.css','app.js','share.html','config.js','qrcode.min.js','logo-lash.svg','manifest.json'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); self.skipWaiting();});
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch',e=>{ const u=new URL(e.request.url); if(u.origin===location.origin){ e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))); } });
