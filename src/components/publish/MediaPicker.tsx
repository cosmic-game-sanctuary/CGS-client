import { Plus, Star, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import type { MediaItem } from '@/mocks/types'

/**
 * Screenshots and clips for the listing.
 *
 * Files never leave the browser: each one becomes an object URL, which is
 * enough to show exactly what buyers would see. The first image is the cover
 * unless another is picked.
 * TODO(integration): these go up with the build in the multipart POST, and the
 * object URLs are replaced by real ones.
 */
export function MediaPicker({
  items,
  coverId,
  onChange,
  onPickCover,
}: {
  items: MediaItem[]
  coverId: string | null
  onChange: (next: MediaItem[]) => void
  onPickCover: (id: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function add(files: FileList | null) {
    if (!files || files.length === 0) return
    const added: MediaItem[] = Array.from(files).map((file, i) => ({
      id: `md_${file.name}_${file.size}_${i}`,
      kind: file.type.startsWith('video/') ? 'video' : 'image',
      url: URL.createObjectURL(file),
    }))
    const next = [...items, ...added.filter((item) => !items.some((e) => e.id === item.id))]
    onChange(next)
    // First image added becomes the cover, unless one is already chosen.
    if (!coverId) {
      const firstImage = next.find((item) => item.kind === 'image')
      if (firstImage) onPickCover(firstImage.id)
    }
  }

  function remove(id: string) {
    const item = items.find((entry) => entry.id === id)
    if (item?.url) URL.revokeObjectURL(item.url)
    const next = items.filter((entry) => entry.id !== id)
    onChange(next)
    if (coverId === id) {
      onPickCover(next.find((entry) => entry.kind === 'image')?.id ?? null)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(event) => {
          add(event.target.files)
          event.target.value = ''
        }}
      />

      <div className="flex flex-wrap gap-3">
        {items.map((item) => (
          <figure
            key={item.id}
            className={cn(
              'group relative m-0 w-32 overflow-hidden rounded-card border-2 bg-paper',
              coverId === item.id ? 'border-ink shadow-hard' : 'border-ink-faint',
            )}
          >
            {item.kind === 'video' ? (
              <video
                src={item.url}
                muted
                playsInline
                preload="metadata"
                className="block aspect-4/3 w-full bg-night object-cover"
              />
            ) : (
              <img
                src={item.url}
                alt=""
                className="block aspect-4/3 w-full bg-night object-cover"
              />
            )}

            <figcaption className="flex items-center justify-between gap-1 border-t-2 border-ink px-1.5 py-1">
              {item.kind === 'image' ? (
                <button
                  type="button"
                  onClick={() => onPickCover(item.id)}
                  aria-pressed={coverId === item.id}
                  aria-label="Use as cover"
                  className={cn(
                    'flex cursor-pointer items-center gap-1 rounded-chip border-0 bg-transparent px-1 py-0.5 font-mono text-[9px] font-bold tracking-wider uppercase',
                    coverId === item.id ? 'text-ink' : 'text-ink-faint hover:text-ink',
                  )}
                >
                  <Star
                    size={10}
                    strokeWidth={3}
                    className={coverId === item.id ? 'fill-yellow' : ''}
                  />
                  Cover
                </button>
              ) : (
                <span className="label-micro px-1 text-ink-faint">Clip</span>
              )}

              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label="Remove"
                className="cursor-pointer rounded-md border-0 bg-transparent p-1 text-ink-faint transition-colors hover:text-pink"
              >
                <Trash2 size={12} strokeWidth={2.5} />
              </button>
            </figcaption>
          </figure>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-4/3 w-32 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed border-ink-faint bg-paper-sunk text-ink-soft transition-colors hover:border-ink hover:text-ink"
        >
          <Plus size={20} strokeWidth={2.5} />
          <span className="label-micro">Add</span>
        </button>
      </div>
    </div>
  )
}
