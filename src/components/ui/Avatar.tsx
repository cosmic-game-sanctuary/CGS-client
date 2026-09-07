import { cn } from '@/lib/utils'

/**
 * A person, at whatever size.
 *
 * Falls back to an initial on paper rather than to a generic silhouette. A
 * stock avatar makes everyone look like the same absent stranger, which is
 * exactly what having profiles was meant to stop; a letter at least belongs to
 * the person it stands for.
 *
 * Square with a hard border, not a circle. Nothing else in this language is
 * round, and one circle would read as borrowed from somewhere else.
 */
export function Avatar({
  src,
  name,
  size = 32,
  className,
}: {
  src?: string | null
  /** Used for the initial and the alt text. */
  name?: string | null
  size?: number
  className?: string
}) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?'
  const style = { width: size, height: size }

  return src ? (
    <img
      src={src}
      alt={name ?? ''}
      width={size}
      height={size}
      style={style}
      className={cn(
        'shrink-0 rounded-chip border-2 border-ink bg-paper-sunk object-cover',
        className,
      )}
    />
  ) : (
    <span
      aria-hidden
      style={style}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-chip border-2 border-ink bg-paper-sunk font-mono font-bold text-ink',
        className,
      )}
    >
      <span style={{ fontSize: Math.max(10, Math.round(size * 0.45)) }}>
        {initial}
      </span>
    </span>
  )
}
