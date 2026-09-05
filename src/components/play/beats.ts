/**
 * Beats for the store to play wipe (DESIGN.md §5). Kept out of the component
 * file so fast refresh stays happy.
 */
export interface Beat {
  label: string
  ms: number
  /** Runs as this beat begins. Checkout uses it to mint at the right moment. */
  at?: () => void
}

/** Buying it. */
export const PURCHASE_BEATS = (onMint: () => void): Beat[] => [
  { label: 'Paying', ms: 750 },
  { label: 'Minting GameKey', ms: 650, at: onMint },
  { label: 'Booting build from IPFS', ms: 700 },
]

/** Already yours. No payment, so no payment theatre. */
export const PLAY_BEATS: Beat[] = [
  { label: 'Checking your key', ms: 550 },
  { label: 'Loading build', ms: 800 },
]

