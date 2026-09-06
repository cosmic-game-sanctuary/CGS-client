/**
 * Beats for the store to play wipe (DESIGN.md §5). Kept out of the component
 * file so fast refresh stays happy.
 */
export interface Beat {
  label: string
  /**
   * How long this beat shows for, as a floor rather than a duration. A beat
   * with real work attached lasts as long as that work takes; the floor only
   * stops a fast one flickering past unread.
   */
  ms: number
  /** Runs as this beat begins, and is not waited on. */
  at?: () => void
  /**
   * The work this beat is actually covering. The sequence waits for it, and a
   * rejection stops the whole thing rather than booting into a game that isn't
   * there. This is what makes the wipe honest: it is the payment and the load
   * taking however long they take, not an animation of the idea of them.
   *
   * `report` fills this beat's own bar, for the one step long enough to need
   * it. A build is tens of megabytes and a bar that sits still for ten seconds
   * reads as a hang.
   */
  work?: (report: (fraction: number) => void) => Promise<unknown>
}

/** Buying it. */
export const PURCHASE_BEATS = (steps: {
  /** Settle the payment. */
  pay: () => Promise<unknown>
  /** Ownership is real from here. Not waited on. */
  minted: () => void
  /** Fetch the build and put it somewhere it can run. */
  boot: (report: (fraction: number) => void) => Promise<unknown>
}): Beat[] => [
  { label: 'Paying', ms: 750, work: steps.pay },
  { label: 'Minting GameKey', ms: 650, at: steps.minted },
  { label: 'Unpacking the build', ms: 400, work: steps.boot },
]

/**
 * Already yours. No payment, so no payment theatre.
 *
 * Both steps are optional because a permalink resolves everything before it
 * goes dark, leaving the beats nothing to wait on. They still run, on their
 * floors, so both routes into a game feel alike.
 */
export const PLAY_BEATS = (steps: {
  check?: () => Promise<unknown>
  boot?: (report: (fraction: number) => void) => Promise<unknown>
} = {}): Beat[] => [
  { label: 'Checking your key', ms: 550, work: steps.check },
  { label: 'Unpacking the build', ms: 400, work: steps.boot },
]
