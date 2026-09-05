import { Play } from 'lucide-react'
import { useState } from 'react'
import { CoverArt } from '@/components/CoverArt'
import { cn } from '@/lib/utils'
import type { MediaItem } from '@/mocks/types'

/**
 * Cover plus screenshots and clips.
 *
 * Sizes to its own content: the listing grid uses `items-start`, so a taller
 * column beside it can never stretch the frame and leave a band of empty
 * paper under the image.
 */
export function MediaGallery({
  items,
  title,
  className,
}: {
  items: MediaItem[]
  title: string
  className?: string
}) {
  const [active, setActive] = useState(0)
  const current = items[active] ?? items[0]
  if (!current) return null

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="overflow-hidden rounded-card border-2 border-ink shadow-hard">
        <Frame item={current} title={title} />
      </div>

      {items.length > 1 ? (
        <ul
          className="flex list-none gap-2.5 overflow-x-auto p-0 pb-1"
          aria-label={`${title} screenshots`}
        >
          {items.map((item, i) => (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-current={i === active}
                aria-label={`View ${item.kind} ${i + 1} of ${items.length}`}
                className={cn(
                  'relative block w-24 cursor-pointer overflow-hidden rounded-md border-2 p-0 transition-transform duration-130 ease-out hover:-translate-y-0.5',
                  i === active
                    ? 'border-ink shadow-hard-sm'
                    : 'border-ink-faint opacity-70 hover:opacity-100',
                )}
              >
                <Thumb item={item} />
                {item.kind === 'video' ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/35">
                    <Play size={16} strokeWidth={3} className="text-paper" />
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Frame({ item, title }: { item: MediaItem; title: string }) {
  if (item.kind === 'video' && item.url) {
    return (
      <video
        key={item.id}
        src={item.url}
        controls
        playsInline
        className="block aspect-4/3 w-full bg-night object-contain"
      />
    )
  }
  if (item.url) {
    return (
      <img
        key={item.id}
        src={item.url}
        alt={`${title} screenshot`}
        className="block aspect-4/3 w-full bg-night object-contain"
      />
    )
  }
  return <CoverArt seed={item.seed ?? 0} title={`${title} artwork`} />
}

function Thumb({ item }: { item: MediaItem }) {
  if (item.url && item.kind === 'image') {
    return (
      <img
        src={item.url}
        alt=""
        className="block aspect-4/3 w-full bg-night object-cover"
      />
    )
  }
  if (item.url && item.kind === 'video') {
    return (
      <video
        src={item.url}
        muted
        playsInline
        preload="metadata"
        className="block aspect-4/3 w-full bg-night object-cover"
      />
    )
  }
  return <CoverArt seed={item.seed ?? 0} />
}
