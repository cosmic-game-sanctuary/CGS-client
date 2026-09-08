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
  /** The frozen transaction aged out before it settled. Nothing was charged. */
  | 'PAYMENT_INTENT_EXPIRED'
  | 'PAYMENT_SIGNATURE_INVALID'
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
  /** A cloud save changed elsewhere since you read it. `details` has both sides. */
  | 'SAVE_CONFLICT'
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

type RequestOptions = {
  method?: string
  /** Serialised as JSON. Use `form` for multipart instead. */
  body?: unknown
  form?: FormData
  query?: Record<string, string | number | boolean | undefined>
  /** Skip the Authorization header even when signed in. */
  anonymous?: boolean
  signal?: AbortSignal
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
  const { method = 'GET', body, form, query, anonymous, signal } = options

  const headers: Record<string, string> = {}
  if (!anonymous) {
    const token = await getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  // Never set Content-Type for FormData; the browser has to add the boundary.
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
      signal,
    })
  } catch (cause) {
    if (signal?.aborted) throw cause
    throw new ApiError(
      0,
      'NETWORK',
      'Could not reach the server. Is it running?',
    )
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
    const token = await getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), { headers, signal })
  } catch (cause) {
    if (signal?.aborted) throw cause
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Is it running?')
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

/** What to put on screen when a call fails. Server copy wins when there is any. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
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
