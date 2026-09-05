import { unzip } from 'fflate'
import {
  BuildError,
  hostExists,
  onServiceWorkerMessage,
  previewHost,
  type HostFile,
} from '@/lib/previewHost'

/**
 * Unpacks a game zip in the browser and mounts it so it can actually run.
 *
 * Files go into the Cache API under /__preview/<id>/…, and `public/preview-sw.js`
 * serves them. Because the build is served from real URLs, the game's own
 * relative paths, fetch, XHR, workers and WASM all resolve without any
 * rewriting.
 *
 * Those URLs are on a **separate origin**, so a build can keep same-origin
 * storage without being same-origin with the app. That's why the write goes
 * through `previewHost()` rather than touching `caches` here: the cache is over
 * there, not here.
 *
 * Entirely client side. Nothing is uploaded anywhere.
 * TODO(integration): the published build comes from IPFS via the x402
 * download instead of a local file, and mounts through this same path.
 */

const PREFIX = '/__preview'

export { BuildError }

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
  /** Absolute URL to load in the iframe, on the build origin. */
  entry: string
  /** Path inside the zip that was used as the entry point. */
  entryPath: string
  fileCount: number
  bytes: number
  /** Every path in the build, for the file list on the publish screen. */
  paths: string[]
  /** False when the build had to run on the app's own origin. */
  isolated: boolean
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

/** Subscribe to files the running build failed to load. */
export function onPreviewMiss(listener: (miss: PreviewMiss) => void) {
  return onServiceWorkerMessage((data) => {
    if (data.kind !== 'miss' && data.kind !== 'rescued') return
    listener({ path: String(data.path), rescued: data.kind === 'rescued' })
  })
}

export function previewSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof caches !== 'undefined'
  )
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
  if (!previewSupported()) {
    throw new BuildError(
      'This browser can’t run builds in the page. Try Chrome, Edge, Firefox or Safari, and not a private window.',
    )
  }

  onStage('worker')
  const host = await previewHost()

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

  const payload: HostFile[] = []
  for (const path of paths) {
    const relative = path.startsWith(root) ? path.slice(root.length) : path
    if (!relative) continue
    // Copy into a fresh buffer: fflate hands back views onto shared memory,
    // and each buffer is handed to the host rather than cloned.
    const body = files[path].slice().buffer as ArrayBuffer
    payload.push({ path: relative, type: mimeFor(relative), body })
  }

  await host.send(
    { op: 'put', base, files: payload },
    payload.map((file) => file.body),
  )

  onStage('starting')

  return {
    id,
    entry: host.origin + base + entryPath.slice(root.length),
    entryPath,
    fileCount: paths.length,
    bytes,
    paths: paths
      .map((path) => (path.startsWith(root) ? path.slice(root.length) : path))
      .sort(),
    isolated: host.isolated,
  }
}

export async function unmountBuild(id: string): Promise<void> {
  // Never spin a host up just to tidy one that was never created.
  if (!hostExists()) return
  const host = await previewHost()
  await host.send({ op: 'drop', id })
}
