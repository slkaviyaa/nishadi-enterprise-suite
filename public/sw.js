const CACHE_NAME = 'nishadi-pos-v2'

self.addEventListener('install', event => { self.skipWaiting() })

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
  )
})

self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone))
        return response
      })
      .catch(() => {
        // Return a proper Response when offline or network fails
        return caches.match(event.request).then(cachedResponse => {
          return cachedResponse || new Response('Offline – resource not cached', {
            status: 503,
            statusText: 'Service Unavailable'
          })
        })
      })
  )
})