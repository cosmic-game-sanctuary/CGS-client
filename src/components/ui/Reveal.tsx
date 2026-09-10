import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Deal — staggered entry, DESIGN.md §4.
 *
 * Fires once, on first scroll into view, and never again on re-scroll. Each
 * direct child animates with Stamp, offset by its own `--i` index, which the
 * call site sets:
 *
 *   <Reveal className="grid ...">
 *     {items.map((item, i) => <Card key={item.id} style={{ '--i': i }} />)}
 *   </Reveal>
 */
export function Reveal({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'ul' | 'section'
}) {
  const ref = useRef<HTMLElement>(null)
  // Without IntersectionObserver there is nothing to wait for, so start shown
  // rather than flipping state inside the effect.
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
      /**
       * **`threshold` must stay 0.** It is a *fraction of this element*, not
       * of the viewport, so on anything taller than the window the ratio can
       * never reach a percentage — a grid 6.7x the viewport height tops out
       * at 0.15 and one taller than that can never satisfy it at any scroll
       * position. The catalog crossed exactly that line at ~44 games and every
       * card stayed at `opacity: 0`: laid out, clickable, invisible. A reveal
       * is "has this scrolled into view", which is threshold 0 by definition;
       * the rootMargin is what holds it back until it is properly in frame.
       */
      { threshold: 0, rootMargin: '0px 0px -40px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref as never}
      data-reveal=""
      data-shown={shown ? 'true' : 'false'}
      className={cn(className)}
    >
      {children}
    </Tag>
  )
}
