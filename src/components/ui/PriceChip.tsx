import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Every value off the ledger is mono with aligned digits — DESIGN.md §2.
 * Green when free, red when the chip *is* the call to action, otherwise ink
 * on paper so it doesn't fight the cover art.
 */
export function PriceChip({
  usd,
  emphasis = 'neutral',
  size = 'md',
  className,
}: {
  usd: number
  emphasis?: 'neutral' | 'cta'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const free = usd === 0

  return (
    <span
      className={cn(
        'font-mono tnum inline-flex items-center whitespace-nowrap border-2 border-ink rounded-chip font-bold',
        size === 'sm' && 'text-[11px] px-2.5 py-0.5',
        size === 'md' && 'text-[13px] px-3 py-1',
        size === 'lg' && 'text-base px-4 py-1.5',
        free && 'bg-green text-paper',
        !free && emphasis === 'cta' && 'bg-red text-paper',
        !free && emphasis === 'neutral' && 'bg-paper text-ink',
        className,
      )}
    >
      {formatPrice(usd)}
    </span>
  )
}
