import { cn } from '@/lib/utils'

/**
 * Candidate marks. All monochrome, all `currentColor`, all legible at 16px.
 * Swap the app-wide default by changing DEFAULT_MARK below — nothing else
 * needs to move.
 *
 * The docs' branding note asks for a clean wordmark rather than an illustrated
 * logo, so every one of these is a flat geometric shape, not a character.
 */
export type MarkName =
  | 'arch'
  | 'cartridge'
  | 'plate'
  | 'stub'
  | 'keyhole'
  | 'fold'

/** Change this one word to change the mark everywhere. */
export const DEFAULT_MARK: MarkName = 'fold'

const MARKS: Record<MarkName, React.ReactNode> = {
  /** Sanctuary doorway with a play triangle knocked out. Reads as a keyhole
   *  at small sizes, which is also on-message. */
  arch: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6 27V13a10 10 0 0 1 20 0v14H6Zm7-15.5v9l8-4.5-8-4.5Z"
    />
  ),

  /** Game cartridge. The most literal "games" read of the six. */
  cartridge: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5 4h22v18h-5v6H10v-6H5V4Zm8.5 5.5v9l8-4.5-8-4.5Z"
    />
  ),

  /** Two riso plates, the top one in register. Literally the brand's
   *  signature motion, frozen. */
  plate: (
    <>
      <rect x="3" y="3" width="19" height="19" rx="2" fill="none" strokeWidth="2.5" stroke="currentColor" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 10h19v19H10V10Zm6.5 5v9l8-4.5-8-4.5Z"
      />
    </>
  ),

  /** Ticket stub, torn at the perforation. Paper → receipts → stubs → keys.
   *  Two separate shapes with a real gap, so it needs no known background. */
  stub: (
    <>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 7h17v18H3V7Zm5.5 4.5v9l8-4.5-8-4.5Z"
      />
      <path d="M23 7h6v18h-6z" />
    </>
  ),

  /** Ownership, plainly. A key that is also a figure standing in a doorway. */
  keyhole: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M16 3a7 7 0 0 0-3.1 13.3L10 28h12l-2.9-11.7A7 7 0 0 0 16 3Zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"
    />
  ),

  /** A page with a dog-ear — a game you kept. The corner is a true cutout
   *  with the folded flap outlined inside it, so the mark carries no
   *  dependency on the colour behind it. */
  fold: (
    <>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5 3h14v8h8v18H5V3Zm7.8 10v8.8l7.8-4.4-7.8-4.4Z"
      />
      <path
        d="M19 3.6 26.4 11H19V3.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </>
  ),
}

export function LogoMark({
  mark = DEFAULT_MARK,
  className,
}: {
  mark?: MarkName
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      className={cn('block h-7 w-7 shrink-0', className)}
    >
      {MARKS[mark]}
    </svg>
  )
}

/** Mark plus wordmark. Used in the header and the footer. */
export function Logo({
  mark,
  className,
  markClassName,
}: {
  mark?: MarkName
  className?: string
  markClassName?: string
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark mark={mark} className={markClassName} />
      <span className="font-wonk text-lg leading-none whitespace-nowrap">
        Cosmic Game Sanctuary
      </span>
    </span>
  )
}
