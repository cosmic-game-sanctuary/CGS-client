import { useCallback, useEffect, useRef } from 'react'
import { getEmbeddedConnectedWallet, useWallets } from '@privy-io/react-auth'

/**
 * Signing and sending with the wallet Privy made for you.
 *
 * This is the half of a purchase that only the browser can do. The server says
 * what has to be signed; the key that signs it belongs to the person sitting
 * here, not to us, and Privy is right to refuse when the server asks on their
 * behalf. The alternative was making every buyer delegate their wallet to the
 * store before their first purchase, which is standing permission to move their
 * money and a far larger thing to agree to than one game.
 *
 * **What gets signed changed with the move to Arc.** It used to be raw hashes
 * via `secp256k1_sign`, because a Hedera transfer had to be frozen on the server
 * before anything could sign it. A payment is now an EIP-3009
 * `TransferWithAuthorization` — ordinary EIP-712 typed data, signed with
 * `eth_signTypedData_v4`. That is strictly better for the person signing: a
 * wallet can *show* them typed data, so "pay 0.30 USDC to this address" is
 * legible where a 32-byte hash was not.
 *
 * Withdrawals send a transaction rather than signing a message, because on Arc
 * the fee is paid in the same USDC being moved — so a wallet with money in it
 * can always afford to move it, and the server has no reason to stand in the
 * middle.
 *
 * No modal, no confirmation step. The confirmation is the checkout screen the
 * buyer is already looking at.
 */

/** EIP-712 payload, exactly as the server handed it over. Do not rebuild it. */
export interface TypedDataRequest {
  domain: Record<string, unknown>
  types: Record<string, { name: string; type: string }[]>
  primaryType: string
  message: Record<string, unknown>
}

export interface TransactionRequest {
  to: string
  /** Wei, decimal string. On Arc the native token is USDC. */
  value: string
  chainId: number
}

export interface WalletSigner {
  /** False until Privy has restored the session and the wallet is connected. */
  ready: boolean
  /** One signature over the whole payload. */
  signTypedData: (request: TypedDataRequest) => Promise<string>
  /** Send from the owner's own wallet. Returns the transaction hash. */
  sendTransaction: (request: TransactionRequest) => Promise<string>
}

export function useWalletSigner(): WalletSigner {
  const { wallets, ready } = useWallets()
  const wallet = ready ? getEmbeddedConnectedWallet(wallets) : null

  // Read through a ref so the callbacks below have a stable identity for the
  // life of the component. They are memoised into boot sequences that must not
  // restart, and Privy hands back a fresh wallets array on plenty of
  // re-renders. "Use whatever wallet is current" is the behaviour we want.
  const walletRef = useRef(wallet)
  useEffect(() => {
    walletRef.current = wallet
  }, [wallet])

  const connected = useCallback(async () => {
    const current = walletRef.current
    if (!current) {
      throw new Error('Your wallet is still connecting. Give it a second.')
    }
    return { wallet: current, provider: await current.getEthereumProvider() }
  }, [])

  const signTypedData = useCallback(
    async (payload: TypedDataRequest) => {
      const { wallet: current, provider } = await connected()
      // Stringified, which is what `eth_signTypedData_v4` takes — and passed
      // through exactly as received. The signature only verifies if every byte
      // of the domain and message matches what the server built, so nothing
      // here reorders, renames or re-types any of it.
      return (await provider.request({
        method: 'eth_signTypedData_v4',
        params: [current.address, JSON.stringify(payload)],
      })) as string
    },
    [connected],
  )

  const sendTransaction = useCallback(
    async (request: TransactionRequest) => {
      const { wallet: current, provider } = await connected()
      // Hex, because that is what the JSON-RPC method expects — a decimal
      // string is silently misread as something else entirely.
      return (await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: current.address,
            to: request.to,
            value: `0x${BigInt(request.value).toString(16)}`,
          },
        ],
      })) as string
    },
    [connected],
  )

  return { ready: wallet !== null, signTypedData, sendTransaction }
}
