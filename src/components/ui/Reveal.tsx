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
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
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
