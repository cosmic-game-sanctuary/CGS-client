import { defineChain, type Chain } from 'viem'
import { arc, arcTestnet } from 'viem/chains'

/**
 * Which Arc this build talks to, fixed at build time by `VITE_ARC_NETWORK`.
 *
 * **It has to match the server's `ARC_NETWORK`.** The server decides where money
 * settles and hands over a chain id with every transaction; this decides which
 * chain Privy's wallet is allowed onto. If they disagree, every wallet write is
 * refused before it is sent (`useWalletSigner`), which is the failure wanted:
 * the alternative is a transaction built for one network and sent on another.
 *
 * Unset means testnet, so a fresh checkout and every existing deploy behave as
 * they did. A value that is neither name is not quietly read as testnet, since a
 * typo in a mainnet deploy would then look like it worked: `PrivyBoot` shows a
 * setup screen naming the variable instead.
 */
export type ArcNetwork = 'testnet' | 'mainnet'

const raw = import.meta.env.VITE_ARC_NETWORK?.trim() || 'testnet'

/** The bad value, when `VITE_ARC_NETWORK` holds one. `PrivyBoot` reports it. */
export const ARC_NETWORK_INVALID: string | null =
  raw === 'testnet' || raw === 'mainnet' ? null : raw

export const ARC_NETWORK: ArcNetwork = raw === 'mainnet' ? 'mainnet' : 'testnet'

/** What a person is told to send on. Shown beside an address, so it is short. */
export const ARC_NETWORK_NAME = ARC_NETWORK === 'mainnet' ? 'Arc' : 'Arc testnet'

/**
 * The server's dev faucet only ever exists on testnet: it hands out the
 * operator's own USDC, and on mainnet that is the platform's real money.
 * On testnet it may still be off (`DEV_FAUCET=off`), which `fund()` reports.
 */
export const HAS_TEST_FAUCET = ARC_NETWORK === 'testnet'

/**
 * viem's `arc` ships with no RPC at all, so it cannot be handed to Privy as it
 * is. This is Circle's public endpoint from docs.arc.io: anonymous, open CORS,
 * no key. `VITE_ARC_RPC_URL` replaces it on either network, for a provider with
 * higher limits. Anything put there ships in the bundle, so a keyed URL has to
 * be one that is restricted to this site's domain on the provider's side.
 */
const MAINNET_RPC = 'https://rpc.mainnet.arc.io'

function withRpc(chain: Chain, override: string | undefined): Chain {
  const url = override?.trim()
  if (!url) return chain
  return { ...chain, rpcUrls: { default: { http: [url] } } }
}

const arcMainnet = defineChain({
  ...arc,
  rpcUrls: { default: { http: [MAINNET_RPC] } },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
})

/** The one chain Privy's wallet may use. */
export const ARC_CHAIN: Chain = withRpc(
  ARC_NETWORK === 'mainnet' ? arcMainnet : arcTestnet,
  import.meta.env.VITE_ARC_RPC_URL,
)
