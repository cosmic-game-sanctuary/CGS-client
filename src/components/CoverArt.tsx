import { cn } from '@/lib/utils'

/**
 * Deterministic placeholder cover art, drawn in the riso palette.
 *
 * Real cover art comes from the dev at publish. Until then the catalog needs
 * to look intentional rather than sparse (frontend brief, priority 3), so each
 * game gets a stable flat-shape composition derived from its `coverSeed`.
 *
 * These are the ONE place saturated colour is allowed to run free: colour
 * belongs to the games, chrome stays ink. DESIGN.md §0.
 */

const PALETTES = [
  { bg: '#2A2440', a: '#00A95C', b: '#FFE800', c: '#16130F' },
  { bg: '#F15060', a: '#16130F', b: '#FBF3E2', c: '#FFE800' },
  { bg: '#0078BF', a: '#FBF3E2', b: '#16130F', c: '#FFE800' },
  { bg: '#00A95C', a: '#16130F', b: '#FBF3E2', c: '#FF48B0' },
  { bg: '#FFE800', a: '#16130F', b: '#F15060', c: '#FBF3E2' },
  { bg: '#16130F', a: '#FF48B0', b: '#FFE800', c: '#00A95C' },
  { bg: '#FF48B0', a: '#16130F', b: '#FBF3E2', c: '#0078BF' },
  { bg: '#3B2F63', a: '#FFE800', b: '#F15060', c: '#FBF3E2' },
]

type Palette = (typeof PALETTES)[number]

/** 200×150 compositions — flat shapes only, no gradients. DESIGN.md §9. */
const COMPOSITIONS: Array<(p: Palette) => React.ReactNode> = [
  // Ridgeline
  (p) => (
    <>
      <circle cx="152" cy="36" r="20" fill={p.b} />
      <path d="M0 150 L44 72 L82 118 L118 60 L160 116 L200 80 L200 150Z" fill={p.a} />
      <path d="M0 150 L38 104 L74 138 L110 94 L150 140 L200 110 L200 150Z" fill={p.c} />
    </>
  ),
  // Halo
  (p) => (
    <>
      <circle cx="100" cy="66" r="42" fill="none" stroke={p.a} strokeWidth="8" />
      <circle cx="100" cy="66" r="19" fill={p.b} />
      <rect x="0" y="116" width="200" height="34" fill={p.c} />
      <rect x="16" y="127" width="54" height="12" fill={p.b} />
    </>
  ),
  // Offset blocks
  (p) => (
    <>
      <rect x="20" y="20" width="74" height="74" fill={p.c} />
      <rect x="104" y="54" width="74" height="74" fill={p.a} />
      <circle cx="57" cy="120" r="18" fill={p.b} />
    </>
  ),
  // Wavefront
  (p) => (
    <>
      <rect x="84" y="22" width="30" height="46" fill={p.b} />
      <path d="M0 92 Q50 62 100 92 T200 92 V150 H0Z" fill={p.a} />
      <path d="M0 114 Q50 86 100 114 T200 114 V150 H0Z" fill={p.c} />
    </>
  ),
  // Beam
  (p) => (
    <>
      <path d="M0 0 L96 0 L0 128Z" fill={p.a} />
      <path d="M200 150 L200 44 L92 150Z" fill={p.c} />
      <circle cx="140" cy="46" r="24" fill={p.b} />
    </>
  ),
  // Column field
  (p) => (
    <>
      {[18, 52, 86, 120, 154].map((x, i) => (
        <rect
          key={x}
          x={x}
          y={i % 2 === 0 ? 34 : 58}
          width="24"
          height={i % 2 === 0 ? 96 : 72}
          fill={i % 3 === 0 ? p.b : p.a}
        />
      ))}
      <rect x="0" y="132" width="200" height="18" fill={p.c} />
    </>
  ),
  // Eclipse
  (p) => (
    <>
      <circle cx="100" cy="72" r="46" fill={p.b} />
      <circle cx="124" cy="60" r="42" fill={p.bg} />
      <rect x="0" y="0" width="200" height="10" fill={p.a} />
      <rect x="0" y="140" width="200" height="10" fill={p.a} />
      <rect x="30" y="118" width="46" height="8" fill={p.c} />
    </>
  ),
  // Switchback
  (p) => (
    <>
      <path
        d="M12 142 L64 142 L64 108 L28 108 L28 74 L96 74 L96 40 L52 40"
        fill="none"
        stroke={p.a}
        strokeWidth="10"
        strokeLinecap="square"
      />
      <circle cx="150" cy="52" r="26" fill={p.b} />
      <rect x="126" y="112" width="60" height="24" fill={p.c} />
    </>
  ),
]

export function CoverArt({
  seed,
  className,
  title,
}: {
  seed: number
  className?: string
  title?: string
}) {
  // Different multipliers so palette and composition don't move together.
  const palette = PALETTES[(seed * 3) % PALETTES.length]
  const draw = COMPOSITIONS[(seed * 5) % COMPOSITIONS.length]

  return (
    <svg
      viewBox="0 0 200 150"
      className={cn('block aspect-4/3 w-full', className)}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="200" height="150" fill={palette.bg} />
      {draw(palette)}
    </svg>
  )
}
