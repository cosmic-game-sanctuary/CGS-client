import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The only element allowed to rotate — DESIGN.md §3. Three words or fewer,
 * never anything containing a sentence.
 */
export function Sticker({
  children,
  tone = 'yellow',
  className,
}: {
  children: ReactNode
  tone?: 'yellow' | 'green' | 'pink' | 'paper'
  className?: string
}) {
  return (
    <span
      className={cn(
        'label-micro inline-block border-2 border-ink rounded-md px-2.5 py-1 shadow-hard-sm',
        tone === 'yellow' && 'bg-yellow text-ink',
        tone === 'green' && 'bg-green text-paper',
        tone === 'pink' && 'bg-pink text-paper',
        tone === 'paper' && 'bg-paper text-ink',
        className,
      )}
    >
      {children}
    </span>
  )
}
