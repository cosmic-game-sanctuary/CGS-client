import { unzip } from 'fflate'

/**
 * Unpacks a game zip in the browser and mounts it so it can actually run.
 *
 * Files go into the Cache API under /__preview/<id>/…, and `public/preview-sw.js`
 * serves them. Because the build is served from real same-origin URLs, the
 * game's own relative paths, fetch, XHR, workers and WASM all resolve without
 * any rewriting.
 *
 * Entirely client side. Nothing is uploaded anywhere.
 * TODO(integration): the published build comes from IPFS via the x402
 * download instead of a local file, and mounts through this same path.
 */

const CACHE = 'cgs-preview'
const PREFIX = '/__preview'

/** 250MB of decompressed build is far past anything a jam game needs. */
const MAX_BYTES = 250 * 1024 * 1024

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  wasm: 'application/wasm',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  webm: 'video/webm',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  txt: 'text/plain; charset=utf-8',
  xml: 'application/xml',
  data: 'application/octet-stream',
  unityweb: 'application/octet-stream',
  br: 'application/octet-stream',
  gz: 'application/octet-stream',
}

function mimeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return MIME[ext] ?? 'application/octet-stream'
}

export interface MountedBuild {
  id: string
  /** URL to load in the iframe. */
  entry: string
  /** Path inside the zip that was used as the entry point. */
  entryPath: string
  fileCount: number
  bytes: number
  /** Every path in the build, for the file list on the publish screen. */
  paths: string[]
}

/** Progress, so a slow unpack never looks like a stuck one. */
export type MountStage =
  | 'worker'
  | 'reading'
  | 'unzipping'
  | 'writing'
  | 'starting'

export const STAGE_LABEL: Record<MountStage, string> = {
  worker: 'Starting the preview server',
  reading: 'Reading the file',
  unzipping: 'Unpacking',
  writing: 'Laying out the build',
  starting: 'Booting it',
}

/** A file the running build asked for that isn't in the zip. */
export interface PreviewMiss {
  path: string
  rescued: boolean
}

const missListeners = new Set<(miss: PreviewMiss) => void>()
let messageBound = false

function bindMessages() {
  if (messageBound || !previewSupported()) return
  messageBound = true
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data
    if (!data || data.source !== 'cgs-preview') return
    if (data.kind !== 'miss' && data.kind !== 'rescued') return
    const miss: PreviewMiss = {
      path: String(data.path),
      rescued: data.kind === 'rescued',
    }
    for (const listener of missListeners) listener(miss)
  })
}

/** Subscribe to files the running build failed to load. */
export function onPreviewMiss(listener: (miss: PreviewMiss) => void) {
  bindMessages()
  missListeners.add(listener)
  return () => {
    missListeners.delete(listener)
  }
}

export class BuildError extends Error {}

// ── service worker ────────────────────────────────────────────────────────

let workerReady: Promise<void> | null = null

export function previewSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof caches !== 'undefined'
  )
}

async function ensureWorker(): Promise<void> {
  if (!previewSupported()) {
    throw new BuildError(
      'This browser can’t run builds in the page. Try Chrome, Edge, Firefox or Safari, and not a private window.',
    )
  }

  workerReady ??= (async () => {
    await navigator.serviceWorker.register('/preview-sw.js', { scope: '/' })
    await navigator.serviceWorker.ready

    // On a first visit the worker activates but isn't controlling this page
    // yet. clients.claim() fixes that; wait for it, but don't hang forever.
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        const done = () => resolve()
        navigator.serviceWorker.addEventListener('controllerchange', done, {
          once: true,
        })
        setTimeout(done, 3000)
      })
    }
  })()

  return workerReady
}

// ── unzip ─────────────────────────────────────────────────────────────────

function inflate(buffer: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(buffer, (error, files) => {
      if (error) reject(new BuildError(`That zip wouldn’t open: ${error.message}`))
      else resolve(files)
    })
  })
}

/**
 * Finds the entry point and the directory to treat as the build root.
 * Handles the common case of a zip that contains one wrapper folder.
 */
function findRoot(paths: string[]): { entryPath: string; root: string } {
  const candidates = paths
    .filter((path) => /(^|\/)index\.html?$/i.test(path))
    .sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length)

  if (candidates.length === 0) {
    throw new BuildError(
      'No index.html in that zip. The game needs one at the root, or inside a single folder.',
    )
  }

  const entryPath = candidates[0]
  const slash = entryPath.lastIndexOf('/')
  return { entryPath, root: slash === -1 ? '' : entryPath.slice(0, slash + 1) }
}

// ── mount ─────────────────────────────────────────────────────────────────

let counter = 0

export async function mountBuild(
  source: File | ArrayBuffer,
  onStage: (stage: MountStage) => void = () => {},
): Promise<MountedBuild> {
  onStage('worker')
  await ensureWorker()
  bindMessages()

  onStage('reading')
  const raw =
    source instanceof ArrayBuffer ? source : await source.arrayBuffer()

  onStage('unzipping')
  const files = await inflate(new Uint8Array(raw))

  // Directory entries come through as empty; drop them and anything hidden.
  const paths = Object.keys(files).filter(
    (path) =>
      !path.endsWith('/') &&
      !path.split('/').some((part) => part.startsWith('__MACOSX') || part === '.DS_Store'),
  )

  if (paths.length === 0) throw new BuildError('That zip is empty.')

  const { entryPath, root } = findRoot(paths)

  const bytes = paths.reduce((sum, path) => sum + files[path].length, 0)
  if (bytes > MAX_BYTES) {
    throw new BuildError(
      `That build unpacks to ${(bytes / 1024 / 1024).toFixed(0)}MB, which is too big to run in the page.`,
    )
  }

  onStage('writing')

  counter += 1
  const id = `b${counter}-${Math.random().toString(36).slice(2, 8)}`
  const base = `${PREFIX}/${id}/`

  const cache = await caches.open(CACHE)
  await Promise.all(
    paths.map((path) => {
      const relative = path.startsWith(root) ? path.slice(root.length) : path
      if (!relative) return Promise.resolve()
      // Copy into a fresh buffer: fflate hands back views onto shared memory.
      const body = files[path].slice()
      return cache.put(
        base + relative,
        new Response(body, {
          headers: {
            'Content-Type': mimeFor(relative),
            'Content-Length': String(body.length),
            'Cache-Control': 'no-store',
          },
        }),
      )
    }),
  )

  onStage('starting')

  return {
    id,
    entry: base + entryPath.slice(root.length),
    entryPath,
    fileCount: paths.length,
    bytes,
    paths: paths
      .map((path) => (path.startsWith(root) ? path.slice(root.length) : path))
      .sort(),
  }
}

export async function unmountBuild(id: string): Promise<void> {
  if (!previewSupported()) return
  const cache = await caches.open(CACHE)
  const keys = await cache.keys()
  await Promise.all(
    keys
      .filter((request) => new URL(request.url).pathname.startsWith(`${PREFIX}/${id}/`))
      .map((request) => cache.delete(request)),
  )
}

/** Clears every previously mounted build. Safe to call on app start. */
export async function clearBuilds(): Promise<void> {
  if (!previewSupported()) return
  await caches.delete(CACHE)
}
