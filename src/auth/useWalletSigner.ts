import { useCallback, useEffect, useRef } from 'react'
import { getEmbeddedConnectedWallet, useWallets } from '@privy-io/react-auth'

/**
 * Signing raw hashes with the wallet Privy made for you.
 *
 * This is the half of a purchase that only the browser can do. The server
 * builds the Hedera transfer and says what has to be signed; the key that has
 * to sign it belongs to the person sitting here, not to us, and Privy is right
 * to refuse when the server asks on their behalf. The alternative was making
 * every buyer delegate their wallet to the store before their first purchase,
 * which is standing permission to move their money and a far larger thing to
 * agree to than one game.
 *
 * `secp256k1_sign` signs the hash exactly as given, with no Ethereum message
 * prefix, which is what Hedera needs. It is a supported method on Privy's own
 * embedded wallet provider, not a workaround: this is the same call Privy makes
 * internally to sign an EIP-7702 authorization.
 *
 * No modal, no confirmation step. The confirmation is the checkout screen the
 * buyer is already looking at.
 */
export interface WalletSigner {
  /** Null until Privy has restored the session and the wallet is connected. */
  ready: boolean
  /**
   * Sign every hash, returning them paired so the server can match each
   * signature to the body it belongs to rather than trusting the order.
   */
  signHashes: (hashes: string[]) => Promise<{ hash: string; signature: string }[]>
}

export function useWalletSigner(): WalletSigner {
  const { wallets, ready } = useWallets()
  const wallet = ready ? getEmbeddedConnectedWallet(wallets) : null

  // Read through a ref so `signHashes` has a stable identity for the life of
  // the component. It is memoised into a boot sequence that must not restart,
  // and Privy hands back a fresh wallets array on plenty of re-renders. "Sign
  // with whatever wallet is current" is the behaviour we want anyway.
  const walletRef = useRef(wallet)
  useEffect(() => {
    walletRef.current = wallet
  }, [wallet])

  const signHashes = useCallback(
    async (hashes: string[]) => {
      const current = walletRef.current
      if (!current) {
        throw new Error('Your wallet is still connecting. Give it a second.')
      }
      const provider = await current.getEthereumProvider()

      // Sequential on purpose. Privy's signer runs in one iframe, and firing
      // three at once made it no faster while making a failure much harder to
      // read. Three signatures land in well under a second either way.
      const signed: { hash: string; signature: string }[] = []
      for (const hash of hashes) {
        const signature: string = await provider.request({
          method: 'secp256k1_sign',
          params: [hash],
        })
        signed.push({ hash, signature })
      }
      return signed
    },
    [],
  )

  return { ready: wallet !== null, signHashes }
}
