/**
 * Serves unpacked game builds from the Cache API so a dropped zip can actually
 * run in an iframe.
 *
 * Runs on the **build origin**, registered by `preview-host.html` — not on the
 * app's origin. See src/lib/previewHost.ts for why builds live somewhere else.
 *
 * The app unzips and hands the files to the host, which writes them into the
 * `cgs-preview` cache under /__preview/<id>/<path>; this worker answers
 * requests from it. Serving real URLs is what makes a build work unchanged: its
 * relative paths, fetch, XHR, workers and WASM all resolve normally.
 *
 * Two things beyond a plain cache lookup:
 *
 * 1. **Absolute-path rescue.** Plenty of engines emit `/build.wasm` or
 *    `/index.data`. Those escape the prefix and 404 against the app. When a
 *    request's referrer is inside a mounted build, we retry it inside that
 *    build before giving up.
 * 2. **Miss reporting.** Every 404 is posted to the page, so the publish
 *    screen can say exactly which file a stuck build asked for. Without this
 *    a broken build is just a black rectangle.
 */

const CACHE = 'cgs-preview'
const PREFIX = '/__preview/'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

async function report(kind, detail) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true })
  for (const client of clients) client.postMessage({ source: 'cgs-preview', kind, ...detail })
}

/** `/__preview/<id>/…` → `<id>`, else null. */
function buildIdOf(pathname) {
  if (!pathname.startsWith(PREFIX)) return null
  return pathname.slice(PREFIX.length).split('/')[0] || null
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  const direct = buildIdOf(url.pathname)

  // A request that left the prefix, but came from inside a build.
  const referrer = event.request.referrer
  const rescueId = direct
    ? null
    : referrer && referrer.startsWith(self.location.origin)
      ? buildIdOf(new URL(referrer).pathname)
      : null

  if (!direct && !rescueId) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)

      // ignoreSearch: engines cache-bust their own assets with ?v=123
      const tryPath = async (pathname) => {
        let hit = await cache.match(pathname, { ignoreSearch: true })
        if (!hit && pathname.endsWith('/')) {
          hit = await cache.match(pathname + 'index.html', { ignoreSearch: true })
        }
        return hit
      }

      let hit = await tryPath(url.pathname)

      if (!hit && rescueId) {
        const rescued = PREFIX + rescueId + url.pathname
        hit = await tryPath(rescued)
        if (hit) {
          await report('rescued', { path: url.pathname, as: rescued })
          return hit
        }
      }

      if (hit) return hit

      await report('miss', { path: url.pathname, buildId: direct ?? rescueId })

      return new Response(`Not in this build: ${url.pathname}`, {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      })
    })(),
  )
})
