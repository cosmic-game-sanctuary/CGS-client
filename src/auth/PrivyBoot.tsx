import { PrivyProvider } from '@privy-io/react-auth'
import type { ReactNode } from 'react'
import { arcTestnet } from 'viem/chains'
import { SessionProvider } from '@/auth/SessionProvider'

/**
 * Privy, configured.
 *
 * Two settings carry weight. `embeddedWallets.ethereum.createOnLogin` has to
 * be on, because the server reads the user's embedded Ethereum wallet out of
 * their Privy account and every authenticated request fails without one. Note
 * it is nested under `ethereum` in v3 of the SDK; the flatter shape the docs
 * describe is silently ignored, which looks exactly like login working and
 * nothing else ever working again.
 *
 * `loginMethods` is email only, on purpose. An external-wallet option would
 * put "connect your wallet" on the first screen of a store that has spent its
 * whole design arguing it is not a crypto app (CLAUDE.md §1).
 *
 * **`supportedChains` and `defaultChain` are what make a wallet write land on
 * Arc at all.** Without them Privy's embedded wallet sits on Ethereum mainnet,
 * and every transaction it sends is built for chain 1 whatever the request
 * said. That was invisible while the only writes were signatures, which carry
 * their chain inside the typed data. The first real transaction — the Gateway
 * deposit's `approve` — went out as a chainId-1 transaction to Privy's mainnet
 * RPC and only failed because the wallet held no mainnet ETH. Withdrawals and
 * agent funding share the same path and would have done the same.
 *
 * Testnet only, deliberately. viem's `arc` mainnet definition ships no RPC, and
 * an embedded wallet on a chain with no RPC fails in ways that are much harder
 * to read than "unsupported chain". If the server is ever pointed at mainnet,
 * `useWalletSigner` refuses the switch loudly rather than sending anywhere.
 *
 * **`showWalletUIs: false`, so Privy never puts its own prompt in front of a
 * payment.** Unset, it inherits the dashboard default, which is to show one —
 * and since the port to Arc every payment is typed data, which Privy prompts
 * for where the old raw-hash signature never did. That put a "sign this"
 * modal over a running game once a minute, for every trial chunk, while the
 * player was mid-level. A trial that interrupts play to ask permission for
 * the play is not a trial anyone finishes.
 *
 * It is safe to turn off here specifically, and the reasons are worth keeping
 * together because removing either one makes it unsafe:
 *
 * - **Every request is one a person already decided on, on our own screen,
 *   with the amount in front of them** — Pay, Set aside, Withdraw, Fund. The
 *   one exception is the trial meter's next chunk, which runs inside a session
 *   the player started knowingly, against a ceiling stated before the first
 *   chunk and enforced by the server.
 * - **Nothing untrusted can reach the wallet.** Uploaded games are the only
 *   third-party code this app runs, and they run on a separate origin with no
 *   path to this page's provider (CLAUDE.md §3, "Why the second origin").
 *   If builds ever ran on this origin, this flag would let any of them sign
 *   for the player silently, and it would have to go back on.
 */
const APP_ID = import.meta.env.VITE_PRIVY_APP_ID

export function PrivyBoot({ children }: { children: ReactNode }) {
  if (!APP_ID) return <MissingAppId />

  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        loginMethods: ['email'],
        defaultChain: arcTestnet,
        supportedChains: [arcTestnet],
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
          showWalletUIs: false,
        },
        appearance: {
          theme: 'light',
          accentColor: '#f15060',
          logo: '/favicon.svg',
          walletChainType: 'ethereum-only',
        },
      }}
    >
      <SessionProvider>{children}</SessionProvider>
    </PrivyProvider>
  )
}

/**
 * A setup problem, not a runtime one, so it says exactly what to do rather
 * than letting Privy throw something about an invalid app id. Only ever seen
 * by whoever is running this locally.
 */
function MissingAppId() {
  return (
    <div className="mx-auto flex min-h-screen max-w-140 flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl">VITE_PRIVY_APP_ID is not set.</h1>
      <p className="font-body leading-relaxed text-ink-soft">
        Sign-in needs the Privy app id. It is the same app the server verifies
        tokens against, so take it from <code>PRIVY_APP_ID</code> in the
        server&rsquo;s <code>.env</code>, or from the Privy dashboard.
      </p>
      <pre className="overflow-x-auto rounded-card border-2 border-ink bg-paper-sunk p-4 font-mono text-[13px]">
        {`# CGS-client/.env.local
VITE_PRIVY_APP_ID=your-app-id`}
      </pre>
      <p className="font-mono text-[11px] text-ink-soft">
        Restart the dev server after adding it. Vite only reads env at startup.
      </p>
    </div>
  )
}
