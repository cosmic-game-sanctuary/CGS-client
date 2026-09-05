import { cn } from '@/lib/utils'
import { freehandIcons, type FreehandName } from './freehand.gen'

/**
 * Tier 1 icons — character. Streamline Freehand, CC BY 4.0.
 *
 * Used LARGE (32px and up): empty states, dropzones, the agent screen,
 * feature callouts, landing decoration. Never in the same visual group, at the
 * same size, as a Lucide icon — see DESIGN.md §7.
 *
 * Inherits `currentColor`, so it takes the semantic colour of its context.
 */
export function Freehand({
  name,
  className,
  title,
}: {
  name: FreehandName
  className?: string
  /** Give a title only when the icon carries meaning of its own. */
  title?: string
}) {
  const icon = freehandIcons[name]
  return (
    <svg
      viewBox={icon.box}
      className={cn('block h-12 w-12 shrink-0', className)}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  )
}

export type { FreehandName }
