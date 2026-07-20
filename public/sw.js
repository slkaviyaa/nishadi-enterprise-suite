const CACHE_NAME = 'nishadi-pos-v1'
const urlsToCache = ['/', '/pos', '/inventory', '/customers', '/reports']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  )
})

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  )
})