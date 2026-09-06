/**
 * Stands in for Privy's optional peer dependencies.
 *
 * Privy's main entry imports Solana, Abstract and Farcaster code paths whose
 * packages are declared optional peers, so they are not installed. Vite stubs
 * an uninstalled optional peer with a module that has no exports, and the
 * build then fails on every named import from it — which reads as a Privy bug
 * rather than as a dependency we deliberately do not have.
 *
 * This is that stub, with exports. It is CommonJS on purpose: named imports
 * from a CJS module are resolved through the namespace object at runtime, so
 * a Proxy can answer for any name, which an ES module cannot do because its
 * exports are static.
 *
 * Everything here throws if anything ever calls it. Nothing can, while
 * `walletChainType` is `ethereum-only` and no Solana or smart-wallet feature
 * is configured. If one of these ever does throw, the fix is to install that
 * peer dependency, not to widen this file.
 */
module.exports = new Proxy(
  {},
  {
    get(_target, property) {
      if (property === '__esModule') return true
      if (typeof property === 'symbol') return undefined
      return function unavailable() {
        throw new Error(
          `${String(property)} needs a Privy optional peer dependency this app ` +
            `does not install. CGS is Hedera and EVM only. ` +
            `See src/lib/unusedChainStub.cjs.`,
        )
      }
    },
  },
)
