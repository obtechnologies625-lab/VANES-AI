const CACHE = 'vanes-shell-v34';
const BASE = new URL('./', self.registration.scope);
const APP_FILES = [
  'index.html',
  'styles.css',
  'vanes-enhancements.css',
  'vanes-brand.css',
  'vanes-reference.css',
  'vanes-runtime.js',
  'vanes-access.js',
  'vanes-firebase.js',
  'vanes-sync.js',
  'vanes-donate.js',
  'full-chat.js',
  'vanes-study-system.js',
  'vanes-premium.js',
  'vanes-profile.js',
  'vanes-notifications.js',
  'vanes-settings.js',
  'vanes-send-fix.js',
  'vanes-brand.js',
  'vanes-product-upgrade.js',
  'vanes-ai-context-fix.js',
  'vanes-profile-enforcer.js',
  'vanes-mobile.js',
  'vanes-pwa.js',
  'manifest.webmanifest',
  'assets/vanes-logo.svg',
  'assets/vanes-logo-lockup.svg',
  'assets/vanes-turbine-wheel.svg',
  'assets/ob-technologies-lab.svg',
  'assets/ob-tech-labs-brain.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-512.png'
];
const APP_SHELL = APP_FILES.map(file => new URL(file, BASE).href);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Firebase's SDK is cross-origin and versioned, so cache it as it is fetched; without this
  // a signed-in learner offline would fall back to the device-only account gate.
  if (url.origin === 'https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => {
        if (cached) return cached;
        // Cache-busting query strings are not in the precache; match the bare path.
        const bare = new URL(url);
        bare.search = '';
        return caches.match(bare.href).then(hit => hit || caches.match(new URL('index.html', BASE).href));
      }))
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow(BASE.href);
    })
  );
});
