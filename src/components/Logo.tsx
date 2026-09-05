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
  | 'saturn'
  | 'arch'
  | 'cartridge'
  | 'plate'
  | 'stub'
  | 'keyhole'
  | 'fold'

/** Change this one word to change the mark everywhere. */
export const DEFAULT_MARK: MarkName = 'saturn'

const MARKS: Record<MarkName, React.ReactNode> = {
  /** A ringed planet, in use since 6 Sep 2026. The ring passes in front of
   *  the planet and out the other side, which in flat monochrome is the
   *  symmetric difference of the two shapes: the planet minus the ring, plus
   *  the ring minus the planet. Done with masks rather than by painting the
   *  crossing band in the background colour, so the mark still works on ink,
   *  on paper and on yellow.
   *
   *  The ids repeat if two Logos are on the page at once. That is fine here
   *  because every instance defines identical geometry, so whichever one the
   *  browser resolves to draws the same shape.
   *
   *  Same geometry, drawn with Pillow, in ../../../social/marks.py. Change
   *  one and change the other, and note that the tilt is NEGATIVE here: SVG
   *  rotates clockwise because its y-axis points down, while PIL's
   *  Image.rotate goes counter-clockwise. Same number in both files would
   *  mirror the mark, which is exactly what happened first time. */
  saturn: (
    <>
      <mask id="cgs-ring" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
        <rect width="32" height="32" fill="#fff" />
        <ellipse
          cx="16"
          cy="17.92"
          rx="14.56"
          ry="4.8"
          transform="rotate(-16 16 17.92)"
          fill="none"
          stroke="#000"
          strokeWidth="2.88"
        />
      </mask>
      <mask id="cgs-planet" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
        <rect width="32" height="32" fill="#fff" />
        <circle cx="16" cy="15.36" r="10.24" fill="#000" />
      </mask>
      <circle cx="16" cy="15.36" r="10.24" mask="url(#cgs-ring)" />
      <ellipse
        cx="16"
        cy="17.92"
        rx="14.56"
        ry="4.8"
        transform="rotate(-16 16 17.92)"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.88"
        mask="url(#cgs-planet)"
      />
    </>
  ),

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
      // Saturn fills the box sideways and runs about two thirds of its
      // height, so the square it sits in is a size up from what the old
      // upright mark needed.
      className={cn('block h-8 w-8 shrink-0', className)}
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
