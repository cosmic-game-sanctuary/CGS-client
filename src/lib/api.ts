/**
 * The one place this app talks to the server.
 *
 * Auth is a bearer token and nothing else. No cookie, so no CSRF handling and
 * no credentials mode. Browsing endpoints work without a token and gain an
 * `owned` flag with one, so `getToken` returning null is a normal state rather
 * than a failure (CGS-docs/INTEGRATION.md §2).
 */

const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
)

/** Codes worth branching on. Anything else is a message we show as-is. */
export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_OWNER'
  | 'NOT_FOUND'
  | 'WALLET_NOT_FUNDED'
  | 'GAME_NOT_PUBLISHED'
  | 'MODERATION_BLOCKED'
  | 'VALIDATION_FAILED'
  | 'SPLITS_LOCKED'
  | 'PAYMENT_REQUIRED'
  | 'PAYMENT_FAILED'
  /** The authorization aged out before it settled. Nothing was charged. */
  | 'PAYMENT_INTENT_EXPIRED'
  /**
   * Settlement didn't resolve inside the wait window. **Not a failure** — the
   * payment may still land, so this is the one refusal that must never be
   * treated as "nothing happened". Retry by completing the *same* intent; see
   * `api/purchase.ts`.
   *
   * It arrives as `409`. It used to be `202`, which is a 2xx, so a client
   * checking `response.ok` read the error envelope as a grant and booted the
   * game on a payment that may have taken the money.
   */
  | 'PAYMENT_PENDING'
  /** That wallet already holds the key. Nothing was charged. */
  | 'ALREADY_OWNED'
  /**
   * A body bigger than the server accepts, and a body that isn't JSON. Both
   * used to arrive as `INTERNAL`, including for an oversized build upload,
   * which is the one case where a person can actually do something about it.
   */
  | 'PAYLOAD_TOO_LARGE'
  | 'MALFORMED_JSON'
  /** Managing a game: under moderation, already sold, or an agent is watching. */
  | 'MODERATION_HOLD'
  | 'GAME_HAS_SALES'
  | 'GAME_IS_WATCHED'
  /**
   * A running sale owns the price, so a direct price edit is refused.
   * `details` carries `promotionId` and `endsAt`.
   */
  | 'PROMOTION_ACTIVE'
  /** One sale at a time. `details` carries the clashing `promotionId`. */
  | 'PROMOTION_EXISTS'
  /** Trials: this game offers none, or the cap has already been reached. */
  | 'TRIAL_NOT_ENABLED'
  | 'TRIAL_CHUNKS_EXHAUSTED'
  /** A founder can't be removed, demoted, or leave. They transfer instead. */
  | 'IS_FOUNDER'
  /**
   * The signed-in account is not the one the invite was sent to. `details`
   * carries the masked `email` it was sent to.
   */
  | 'INVITE_EMAIL_MISMATCH'
  /** A cloud save changed elsewhere since you read it. `details` has both sides. */
  | 'SAVE_CONFLICT'
  /** Nothing has accrued in the vault for this payee yet. */
  | 'NOTHING_TO_CLAIM'
  /** The agent: absent, already created, retired, or not waiting on an answer. */
  | 'NO_AGENT'
  | 'AGENT_EXISTS'
  | 'AGENT_ALREADY_RETIRED'
  | 'NOT_ASKABLE'
  /**
   * Over the ceiling published on the agent's own ENS name (`cgs:maxSpend`).
   * Enforced on chain rather than advertised, so this is a refusal, not advice.
   */
  | 'ABOVE_MANDATE'
  /** Groq was unreachable, so the deterministic plan ran instead. */
  | 'MODEL_UNAVAILABLE'
  /** Already dealt with by the time this arrived. Moderation, or an agent question. */
  | 'ALREADY_RESOLVED'
  | 'HANDLE_TAKEN'
  | 'STUDIO_EXISTS'
  | 'WITHDRAW_FAILED'
  | 'UPLOAD_REJECTED'
  /**
   * `503`, and the one code here that is nobody's fault but ours: the server is
   * missing the Arc key or contract addresses it needs to write to the chain.
   * Not a thing a person can fix by retrying, so say so rather than offering to.
   */
  | 'CHAIN_NOT_CONFIGURED'
  /** Circle could not be asked for a Gateway balance. Not the same as zero. */
  | 'GATEWAY_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'NETWORK'

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode | string
  readonly details?: unknown

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  /**
   * `VALIDATION_FAILED` puts per-field messages in `details`, in one of two
   * shapes, and reading only the first is how a useful message becomes a
   * useless one.
   *
   * The validate middleware sends Zod's `flatten()`, so `{ fieldErrors: { to:
   * ["..."] } }`. A route handler that refuses something Zod cannot check
   * throws `Errors.validationFailed({ to: "..." })` instead, which arrives as a
   * plain map of field to sentence. That second kind is where the *interesting*
   * refusals live — a destination with no account, a sale price above the
   * current one, an expired intent — and they were all being reported as "that
   * request doesn't look right".
   */
  get fieldErrors(): Record<string, string[]> {
    const details = this.details
    if (!details || typeof details !== 'object') return {}

    const flattened = (details as { fieldErrors?: Record<string, string[]> })
      .fieldErrors
    if (flattened) return flattened

    const out: Record<string, string[]> = {}
    for (const [field, message] of Object.entries(details)) {
      if (typeof message === 'string') out[field] = [message]
      else if (Array.isArray(message)) {
        out[field] = message.filter((m): m is string => typeof m === 'string')
      }
    }
    return out
  }

  /** The first field message there is, whatever the field is called. */
  get firstFieldError(): string | undefined {
    return Object.values(this.fieldErrors).flat()[0]
  }
}

/**
 * Set once, when the auth provider mounts. A function rather than a value so
 * the token is read at call time and a refresh is never missed.
 * TODO(W2): Privy's `getAccessToken` goes here.
 */
let getToken: () => Promise<string | null> = async () => null

export function setTokenSource(source: () => Promise<string | null>) {
  getToken = source
}

/**
 * Reject a promise that has not settled in time, with a readable message.
 * Used to put a ceiling on the two awaits that can silently stall a payment
 * or a build download: a hung `getAccessToken`, and a `fetch` with no answer.
 */
export function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new ApiError(0, 'NETWORK', message)), ms),
    ),
  ])
}

type RequestOptions = {
  method?: string
  /** Serialised as JSON. Use `form` for multipart instead. */
  body?: unknown
  form?: FormData
  query?: Record<string, string | number | boolean | undefined>
  /** Skip the Authorization header even when signed in. */
  anonymous?: boolean
  signal?: AbortSignal
  /** Override the default 90s ceiling. For calls that do chain work. */
  timeoutMs?: number
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(`${BASE}${path}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === '') continue
    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, form, query, anonymous, signal, timeoutMs } = options

  const headers: Record<string, string> = {}
  if (!anonymous) {
    const token = await getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  // Never set Content-Type for FormData; the browser has to add the boundary.
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  // A ceiling on any single call. The payment steps are the reason: a
  // `/pay/complete` or a `/trial/chunks/complete` that never comes back left
  // the checkout sat on its overlay with the money already gone and no error,
  // because nothing anywhere in the chain ever gave up. A request that has
  // genuinely stalled has to become an error a person can see and retry.
  // 90s clears the slowest honest case (settlement plus a background split
  // run behind it) with room to spare.
  //
  // **A caller may ask for longer, and publishing has to.** Locking a draft
  // deploys the game's vault and writes the registry, which is two chain
  // transactions, and a build upload is tens of megabytes over whatever link
  // the developer happens to have. Neither fits in a ceiling chosen for a
  // payment. See `requestUpload` for the upload half, which cannot use this
  // function at all.
  const REQUEST_TIMEOUT_MS = timeoutMs ?? 90_000
  const timeout = new AbortController()
  const bell = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS)
  // Honour a caller's own signal too — abort if either fires.
  const onCallerAbort = () => timeout.abort()
  signal?.addEventListener('abort', onCallerAbort)

  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
      signal: timeout.signal,
    })
  } catch (cause) {
    if (signal?.aborted) throw cause
    if (timeout.signal.aborted) {
      throw new ApiError(
        0,
        'NETWORK',
        'The server took too long to answer. If this was a payment, check your ' +
          'wallet before trying again — nothing may have been charged, but do not assume.',
      )
    }
    throw new ApiError(
      0,
      'NETWORK',
      'Could not reach the server. Is it running?',
    )
  } finally {
    clearTimeout(bell)
    signal?.removeEventListener('abort', onCallerAbort)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const payload = text ? safeParse(text) : undefined

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: unknown } })?.error
    throw new ApiError(
      response.status,
      error?.code ?? 'INTERNAL',
      error?.message ?? `Request failed (${response.status}).`,
      error?.details,
    )
  }

  return payload as T
}

/**
 * A binary body, with the same auth and the same errors as `request`.
 *
 * Separate because everything else here is JSON, and a build zip is tens of
 * megabytes: parsing it as text first would double the memory for no reason.
 * `onProgress` reports bytes as they land where the server said how many to
 * expect, so a slow download reads as progress rather than as a stall.
 */
export async function requestBytes(
  path: string,
  options: RequestOptions & { onProgress?: (loaded: number, total: number) => void } = {},
): Promise<ArrayBuffer> {
  const { query, anonymous, signal, onProgress } = options

  const headers: Record<string, string> = {}
  if (!anonymous) {
    // Bounded. `getAccessToken` normally returns a cached token in a
    // millisecond, but if Privy is mid-refresh it can sit, and a build
    // download that never even starts its fetch is one of the ways the play
    // overlay hung with no error.
    const token = await withTimeout(
      getToken(),
      10_000,
      'Signing in took too long. Reload and try again.',
    )
    if (token) headers.Authorization = `Bearer ${token}`
  }

  // 3 minutes: a real build is ~23MB and this includes the whole download.
  const cap = new AbortController()
  const bell = setTimeout(() => cap.abort(), 180_000)
  const onCallerAbort = () => cap.abort()
  signal?.addEventListener('abort', onCallerAbort)

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), { headers, signal: cap.signal })
  } catch (cause) {
    if (signal?.aborted) throw cause
    if (cap.signal.aborted) {
      throw new ApiError(0, 'NETWORK', 'The build took too long to download. Reload and try again.')
    }
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Is it running?')
  } finally {
    clearTimeout(bell)
    signal?.removeEventListener('abort', onCallerAbort)
  }

  if (!response.ok) {
    const payload = safeParse(await response.text()) as
      | { error?: { code?: string; message?: string; details?: unknown } }
      | undefined
    throw new ApiError(
      response.status,
      payload?.error?.code ?? 'INTERNAL',
      payload?.error?.message ?? `Request failed (${response.status}).`,
      payload?.error?.details,
    )
  }

  const total = Number(response.headers.get('content-length') ?? 0)
  if (!onProgress || !response.body || !total) return response.arrayBuffer()

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    onProgress(loaded, total)
  }

  const out = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out.buffer
}

/**
 * What to put on screen when a call fails. Server copy wins when there is any.
 *
 * Fell back to a bare generic line for anything that wasn't an `ApiError`,
 * which silently ate every message a plain `Error` was thrown with on
 * purpose — the wallet-not-ready error below, `BuildError`'s specific
 * unzip/size/host failures, and the boot sequence's own "did not finish, check
 * your wallet" timeout all wrote real text that nobody could ever see. A
 * message written at a throw site is written to be shown.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong. Try that again.'
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** A 404 is a real answer for "does this exist", not an error to surface. */
export async function requestOptional<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T | undefined> {
  try {
    return await request<T>(path, options)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined
    throw error
  }
}

/**
 * A multipart upload that can say how far along it is.
 *
 * **`XMLHttpRequest`, deliberately, in a file where everything else is
 * `fetch`.** `fetch` cannot report upload progress: there is no event for it,
 * and the streaming-request workaround needs `duplex: 'half'` and is not
 * usable across the browsers this has to work in. XHR has had
 * `upload.onprogress` for fifteen years. So the one call that genuinely needs
 * it uses it, and the rest of the file stays on `fetch`.
 *
 * **The timing is a stall timer, not a deadline, and that is the whole point.**
 * A build is tens of megabytes and the developer's upstream is theirs, not
 * ours: 22.5MB over a slow domestic connection is minutes of honest work, and
 * a flat ceiling cannot tell that apart from a dead socket. So nothing is
 * capped while bytes are moving. The clock only runs when nothing has happened,
 * and it resets on every progress event.
 *
 * After the last byte goes up the request is not over, and the wait that
 * follows is the longest part of publishing: the server unpacks the zip, runs
 * the moderation gate and pins the build to IPFS **twice**, once as a
 * directory for provenance and once as a zip for delivery. Nothing is
 * observable from here during that, so `onSent` exists to let the UI stop
 * showing a percentage and say what is actually happening instead.
 */
export async function requestUpload<T>(
  path: string,
  form: FormData,
  options: {
    /** 0 to 1, bytes accepted by the socket. Fires many times. */
    onProgress?: (fraction: number) => void
    /** Every byte is up. From here the server is working and we are blind. */
    onSent?: () => void
    /** With no progress at all for this long, give up. */
    stallMs?: number
    /** How long to wait after the upload finishes, while the server works. */
    serverMs?: number
    signal?: AbortSignal
  } = {},
): Promise<T> {
  const {
    onProgress,
    onSent,
    stallMs = 60_000,
    // Ten minutes. Two IPFS pins of the same build, and Pinata is not fast.
    serverMs = 600_000,
    signal,
  } = options

  const token = await getToken()

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', buildUrl(path))
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    // No Content-Type: the browser has to add the multipart boundary itself.

    let bell: number | undefined
    const stopClock = () => {
      if (bell !== undefined) clearTimeout(bell)
      bell = undefined
    }
    const armClock = (ms: number, message: string) => {
      stopClock()
      bell = window.setTimeout(() => {
        xhr.abort()
        reject(new ApiError(0, 'NETWORK', message))
      }, ms)
    }

    const cleanUp = () => {
      stopClock()
      signal?.removeEventListener('abort', onCallerAbort)
    }
    const onCallerAbort = () => {
      cleanUp()
      xhr.abort()
    }
    signal?.addEventListener('abort', onCallerAbort)

    armClock(stallMs, 'The upload stalled before it started. Check your connection and try again.')

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      // Re-armed on every chunk, so a slow but live upload never trips it.
      armClock(stallMs, 'The upload stopped partway. Nothing was published, so it is safe to retry.')
      onProgress?.(event.loaded / event.total)
    }

    xhr.upload.onload = () => {
      onProgress?.(1)
      onSent?.()
      armClock(
        serverMs,
        'The build went up, but the server is still working on it. Check your library in a minute before retrying, in case the draft was created.',
      )
    }

    xhr.onload = () => {
      cleanUp()
      const payload = safeParse(xhr.responseText) as
        | { error?: { code?: string; message?: string; details?: unknown } }
        | undefined

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve((payload ?? {}) as T)
        return
      }
      reject(
        new ApiError(
          xhr.status,
          payload?.error?.code ?? 'INTERNAL',
          payload?.error?.message ?? `Upload failed (${xhr.status}).`,
          payload?.error?.details,
        ),
      )
    }

    xhr.onerror = () => {
      cleanUp()
      reject(new ApiError(0, 'NETWORK', 'Could not reach the server. Is it running?'))
    }

    // Fired by our own `abort()` above, where the rejection has already been
    // sent. Only a genuine user cancel reaches the reject below.
    xhr.onabort = () => {
      cleanUp()
      reject(new ApiError(0, 'NETWORK', 'The upload was cancelled.'))
    }

    xhr.send(form)
  })
}
