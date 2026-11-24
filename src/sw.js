const manifest = self.__WB_MANIFEST
const scope = self.registration.scope
const indexUrl = new URL('index.html', scope).href
const urls = [...new Set([...manifest.map((entry) => new URL(entry.url, scope).href), indexUrl])]
const version = manifest.map((entry) => entry.revision || entry.url).join('|')
const cacheName = 'stop-jir-shell-' + encodeURIComponent(version)

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(urls)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('stop-jir-shell-') && key !== cacheName) await caches.delete(key)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(cacheName)
      return (await cache.match(indexUrl)) ?? Response.error()
    }))
  } else if (urls.includes(request.url)) {
    event.respondWith(caches.open(cacheName).then(async (cache) => (await cache.match(request)) ?? fetch(request)))
  }
})
