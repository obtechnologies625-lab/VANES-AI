const CACHE = 'vanes-shell-v23';
const BASE = new URL('./', self.registration.scope);
const APP_FILES = [
  'index.html',
  'styles.css',
  'vanes-enhancements.css',
  'vanes-brand.css',
  'vanes-reference.css',
  'vanes-runtime.js',
  'vanes-donate.js',
  'full-chat.js',
  'vanes-study-system.js',
  'vanes-functional-fix-v2.js',
  'vanes-profile.js',
  'vanes-notifications.js',
  'vanes-settings.js',
  'vanes-send-fix.js',
  'vanes-brand.js',
  'vanes-product-upgrade.js',
  'vanes-ai-context-fix.js',
  'vanes-profile-enforcer.js',
  'vanes-mobile.js',
  'manifest.webmanifest',
  'assets/vanes-logo.svg',
  'assets/vanes-turbine-wheel.svg',
  'assets/ob-technologies-lab.svg',
  'assets/ob-tech-labs-brain.svg'
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
        return caches.match(new URL('index.html', BASE).href);
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
