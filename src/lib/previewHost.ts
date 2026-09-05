/**
 * The origin that runs uploaded builds, and the client that talks to it.
 *
 * ── Why builds need an origin of their own ────────────────────────────────
 * A build has to be served from real URLs, and the iframe has to keep
 * `allow-same-origin`, or every engine that touches localStorage or IndexedDB
 * throws on boot with no visible error. Doing that on our own origin hands a
 * stranger's game the run of the app: the session, the wallet, the DOM.
 *
 * So the build gets its own origin, the way itch.io serves games from
 * html-classic.itch.zone. The frame is then same-origin with *itself* and
 * cross-origin with us, which is the property we actually wanted all along.
 *
 * The cache and the service worker live over there too, which is why writing a
 * build goes through a hidden host page instead of calling `caches` directly.
 *
 * Dev needs no configuration. `localhost`, `127.0.0.1` and `[::1]` are the same
 * machine and three different origins, so the app on one runs builds on
 * another. Which of them the dev server actually listens on is not knowable in
 * advance (Vite binds whatever `localhost` resolves to, and on Windows that is
 * usually `[::1]` alone), so they get probed rather than assumed.
 *
 * Deployments set VITE_PREVIEW_ORIGIN to a real subdomain.
 */

export class BuildError extends Error {}

/**
 * The same machine under other names, in the order worth trying. Only used in
 * dev; a deployment sets VITE_PREVIEW_ORIGIN and never reaches this.
 */
function localTwins(): string[] {
  const { protocol, hostname, port } = window.location
  const suffix = port ? `:${port}` : ''
  const twins: Record<string, string[]> = {
    localhost: ['[::1]', '127.0.0.1'],
    '127.0.0.1': ['localhost', '[::1]'],
    '[::1]': ['localhost', '127.0.0.1'],
  }
  // hostname keeps the brackets on an IPv6 literal in most engines, but not
  // all of them, so accept either spelling.
  const key = hostname === '::1' ? '[::1]' : hostname
  return (twins[key] ?? []).map((host) => `${protocol}//${host}${suffix}`)
}

/**
 * The app's own origin must not own a service worker or a build cache. Both
 * moved to the build origin, but the registration written before that change
 * survives a reload and keeps controlling the page, so anyone who ran the old
 * build still has one. It shows up in DevTools looking like the live worker,
 * which is worse than useless.
 *
 * Safe to run unconditionally: if the build origin turns out to be unreachable,
 * the host page falls back to this origin and registers again itself, and
 * `previewHost()` waits for this to finish before that can happen.
 */
let sweptApp: Promise<void> | null = null

export function dropAppServiceWorkers(): Promise<void> {
  sweptApp ??= (async () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }
    try {
      // getRegistrations() is per origin, so this is only ever ours.
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((entry) => entry.unregister()))
      if (typeof caches !== 'undefined') await caches.delete('cgs-preview')
    } catch {
      // Storage blocked. Nothing was written here in the first place, then.
    }
  })()
  return sweptApp
}

/**
 * Is anything serving there? An opaque no-cors response is a yes; only a
 * genuine network failure rejects. Cheap, and it saves waiting out the iframe
 * timeout on a name nothing is listening on.
 */
async function reachable(origin: string): Promise<boolean> {
  try {
    await fetch(`${origin}/preview-sw.js`, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
    })
    return true
  } catch {
    return false
  }
}

// ── protocol ──────────────────────────────────────────────────────────────

/** One file of an unpacked build, ready to hand over. */
export interface HostFile {
  path: string
  type: string
  body: ArrayBuffer
}

type Command =
  | { op: 'put'; base: string; files: HostFile[] }
  | { op: 'drop'; id: string }

export interface PreviewLink {
  /** Origin the build will actually be served from. */
  origin: string
  /** False when we had to fall back to the app's own origin. */
  isolated: boolean
  send(command: Command, transfer?: Transferable[]): Promise<void>
}

/** A host that never answers is a host that isn't there. */
const CONNECT_TIMEOUT_MS = 8000

// Messages the worker sends about missing files, relayed up by the host.
const swListeners = new Set<(data: Record<string, unknown>) => void>()

export function onServiceWorkerMessage(
  listener: (data: Record<string, unknown>) => void,
) {
  swListeners.add(listener)
  return () => {
    swListeners.delete(listener)
  }
}

function connect(origin: string): Promise<PreviewLink> {
  return new Promise<PreviewLink>((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.title = 'Build host'
    frame.tabIndex = -1
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;visibility:hidden'
    frame.src = `${origin}/preview-host.html?app=${encodeURIComponent(
      window.location.origin,
    )}`

    const pending = new Map<
      number,
      { ok: () => void; fail: (error: Error) => void }
    >()
    let ticket = 0
    let settled = false

    const timer = window.setTimeout(() => {
      finish(new BuildError(`No answer from the build host at ${origin}.`))
    }, CONNECT_TIMEOUT_MS)

    function finish(error?: Error) {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      if (error) {
        window.removeEventListener('message', onMessage)
        frame.remove()
        reject(error)
        return
      }
      resolve({
        origin,
        isolated: origin !== window.location.origin,
        send(command, transfer = []) {
          return new Promise<void>((ok, fail) => {
            ticket += 1
            pending.set(ticket, { ok, fail })
            frame.contentWindow?.postMessage(
              { ...command, source: 'cgs-preview-app', ticket },
              origin,
              transfer,
            )
          })
        },
      })
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== frame.contentWindow || event.origin !== origin) return
      const data = event.data as Record<string, unknown> | null
      if (!data || data.source !== 'cgs-preview-host') return

      switch (data.kind) {
        case 'ready':
          finish()
          return
        case 'blocked':
          finish(new BuildError(String(data.error ?? 'The build host refused.')))
          return
        case 'sw': {
          const payload = data.data as Record<string, unknown>
          for (const listener of swListeners) listener(payload)
          return
        }
        default: {
          const entry = pending.get(Number(data.ticket))
          if (!entry) return
          pending.delete(Number(data.ticket))
          if (data.kind === 'done') entry.ok()
          else entry.fail(new BuildError(String(data.error ?? 'Host error.')))
        }
      }
    }

    window.addEventListener('message', onMessage)
    document.body.append(frame)
  })
}

let link: Promise<PreviewLink> | null = null

/**
 * The one host for this page.
 *
 * A configured origin that doesn't answer is a deployment bug and fails loudly,
 * because quietly running a stranger's build on the app's own origin is the
 * exact thing this file exists to prevent. With nothing configured we're on
 * someone's laptop, so an unreachable twin falls back with a warning: a dev
 * who can't see their own build learns nothing from the refusal.
 */
export function previewHost(): Promise<PreviewLink> {
  link ??= (async () => {
    await dropAppServiceWorkers()

    const configured = import.meta.env.VITE_PREVIEW_ORIGIN?.trim()
    if (configured) return connect(configured.replace(/\/+$/, ''))

    for (const candidate of localTwins()) {
      if (!(await reachable(candidate))) continue
      try {
        return await connect(candidate)
      } catch (error) {
        console.warn(`[cgs] build host at ${candidate} did not start.`, error)
      }
    }

    console.warn(
      '[cgs] no separate build origin, so builds run on this one. Fine on a ' +
        'laptop. Not fine in production: set VITE_PREVIEW_ORIGIN.',
    )
    return connect(window.location.origin)
  })()
  return link
}

/** True once a host exists, so teardown never spawns one just to tidy up. */
export function hostExists(): boolean {
  return link !== null
}
