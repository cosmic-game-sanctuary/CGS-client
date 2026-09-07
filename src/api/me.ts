import { request } from '@/lib/api'

/** `GET /api/me`. Identity, live wallet balance, and the studio you belong to. */
/** A studio you can act in. */
export interface WireMeStudio {
  id: string
  name: string
  slug: string
  role: 'owner' | 'member'
}

export interface WireMe {
  id: string
  email: string
  evmAddress: string
  /** Your public name, and the address of your profile page. */
  handle: string | null
  displayName: string | null
  /**
   * What to print. The server resolves display name, then handle, then email,
   * so nothing here has to reimplement that and get it subtly different.
   */
  label: string
  avatarUrl: string | null
  libraryPublic: boolean
  /** Null until the wallet has received value. No account means no balance. */
  hederaAccountId: string | null
  balanceUnits: string | null
  balanceAsset: string
  balanceUsd: number
  balanceAssetDecimals: number
  /**
   * Tinybars, and reported apart from the settlement asset because it is not
   * spending money here: the facilitator covers the fee on a purchase and the
   * operator covers it on a withdrawal. A wallet holding some HBAR and no USDC
   * is funded with nothing to spend, and that read as empty without this.
   */
  hbarUnits: string | null
  hbar: number
  /** Whichever studio is primary. Kept so existing callers don't move. */
  studio: (WireMeStudio & { handle: string }) | null
  /** Every studio you own or joined. Being on two teams is normal. */
  studios: WireMeStudio[]
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
