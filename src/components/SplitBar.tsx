import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { SplitMember } from '@/mocks/types'

/**
 * The signature component — the most differentiated feature in the product.
 *
 * Animates with Grow (DESIGN.md §4): segments draw left to right so you watch
 * the ratio assemble, and each percentage fades in only once its own segment
 * has landed. The number arrives after the proof.
 *
 * Read-only. Splits lock at publish and no edit affordance may exist anywhere
 * in this app — DESIGN.md §9, CLAUDE.md §1.
 */

const SEGMENT_COLOURS = [
  'bg-green',
  'bg-blue',
  'bg-pink',
  'bg-red',
  'bg-ink',
] as const

const STAGGER_MS = 160

export function SplitBar({
  splits,
  className,
}: {
  splits: SplitMember[]
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(
    () => typeof IntersectionObserver === 'undefined',
  )

  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={cn(className)}>
      <div className="flex h-9 overflow-hidden rounded-chip border-2 border-ink shadow-hard-sm">
        {splits.map((member, i) => (
          <div
            key={member.handle}
            data-shown={shown ? 'true' : 'false'}
            style={{
              flex: `0 0 ${member.pct}%`,
              animationDelay: `${180 + i * STAGGER_MS}ms`,
            }}
            className={cn(
              'split-seg flex items-center justify-center border-r-2 border-ink last:border-r-0',
              SEGMENT_COLOURS[i % SEGMENT_COLOURS.length],
            )}
          >
            <span
              style={{ transitionDelay: `${500 + i * STAGGER_MS}ms` }}
              className={cn(
                'font-mono tnum text-xs font-bold text-paper transition-opacity duration-300',
                shown ? 'opacity-100' : 'opacity-0',
              )}
            >
              {member.pct}%
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex">
        {splits.map((member) => (
          <div
            key={member.handle}
            style={{ flex: `0 0 ${member.pct}%` }}
            className="min-w-0 pr-2"
          >
            <span className="block truncate font-mono text-xs font-semibold text-ink">
              {member.handle}
            </span>
            <span className="block truncate font-mono text-[11px] text-ink-soft">
              {member.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
