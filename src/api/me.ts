import { request } from '@/lib/api'

/** `GET /api/me`. Identity, live wallet balance, and the studio you belong to. */
export interface WireMe {
  id: string
  email: string
  evmAddress: string
  /** Null until the wallet has received value. No account means no balance. */
  hederaAccountId: string | null
  balanceUnits: string | null
  balanceAsset: string
  balanceUsd: number
  balanceAssetDecimals: number
  studio: {
    id: string
    name: string
    slug: string
    role: 'owner' | 'member'
    handle: string
  } | null
}

export function getMe(signal?: AbortSignal): Promise<WireMe> {
  return request<WireMe>('/api/me', { signal })
}

export interface WireFaucetResult {
  address: string
  accountId: string | null
  sentUnits: string
  balanceUnits: string
  balanceUsd: number
}

/**
 * Development only, and only when the server was started with DEV_FAUCET=on.
 * The operator account is the one thing that can put a first balance in a
 * Privy wallet, since nothing hands out testnet USDC to an address and the
 * browser never holds the key. See CGS-server/src/routes/dev.routes.ts.
 */
export function faucet(
  body: { target?: 'me' | 'agent'; agentId?: string; amount?: number } = {},
): Promise<WireFaucetResult> {
  return request<WireFaucetResult>('/api/dev/faucet', {
    method: 'POST',
    body: { target: 'me', ...body },
  })
}
