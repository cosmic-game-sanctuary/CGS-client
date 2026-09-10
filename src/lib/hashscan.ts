/**
 * Links to the public explorer.
 *
 * Everything this app claims about money is checkable by a stranger, and a
 * claim nobody can check is worth very little. So anywhere a transaction id is
 * shown, it should be reachable in one click rather than something a person is
 * expected to copy into a search box.
 *
 * Hedera's own ids are `0.0.x@seconds.nanos`; HashScan wants the `-` form
 * (`0.0.x-seconds-nanos`), and hands back a "not found" page for the raw one.
 */
const NETWORK = import.meta.env.VITE_HEDERA_NETWORK ?? 'testnet'

export function hashscanTx(transactionId: string): string {
  const normalised = transactionId.replace('@', '-').replace(/\.(\d+)$/, '-$1')
  return `https://hashscan.io/${NETWORK}/transaction/${normalised}`
}
