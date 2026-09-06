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

  /** `VALIDATION_FAILED` puts per-field messages in `details`. */
  get fieldErrors(): Record<string, string[]> {
    const d = this.details as { fieldErrors?: Record<string, string[]> } | undefined
    return d?.fieldErrors ?? {}
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
