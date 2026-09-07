import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { addMedia, editGame, removeMedia, reorderMedia } from '@/api/manage'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { WireGame, WireMedia } from '@/api/wire'

/**
 * Screenshots and clips, after publishing.
 *
 * Order is the whole job here: the first frame is what a stranger judges the
 * game on, and it was fixed at upload with no way to change it. Arrows rather
 * than drag-and-drop, because two people on a jam deadline need this to work
 * on a trackpad and on a phone, and a drag target that needs a steady hand is
 * a worse answer than a button.
 *
 * The cover is a separate idea from position one. A studio may want the best
 * screenshot first in the gallery and a different image as the catalog tile.
 */
export function MediaManager({
  game,
  media,
  onChanged,
}: {
  game: WireGame
  media: WireMedia[]
  onChanged: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // Reordering is shown immediately and sent in the background. It used to
  // await the write and then refetch the whole manage view — which re-counts
  // sales, owners and plays, and asks the Mirror Node — so swapping two
  // thumbnails took as long as loading the page. Nothing about moving an image
  // needs any of those numbers.
  //
  // The local order is tagged with the array it was derived from rather than
  // synced in an effect. A fresh fetch arrives as a new array, which makes the
  // tag stale and the server's order win again, with no cascading render.
  const [moved, setMoved] = useState<{
    from: WireMedia[]
    order: WireMedia[]
  } | null>(null)
  const order = moved?.from === media ? moved.order : media

  async function run(work: () => Promise<unknown>) {
    setBusy(true)
    setProblem(null)
    try {
      await work()
      onChanged()
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  function move(index: number, by: number) {
    const target = index + by
    if (target < 0 || target >= order.length) return

    const next = [...order]
    ;[next[index], next[target]] = [next[target], next[index]]
    setMoved({ from: media, order: next })
    setProblem(null)

    void reorderMedia(
      game.id,
      next.map((item) => item.id),
    ).catch((error: unknown) => {
      // Put it back rather than leaving the screen disagreeing with the server.
      setMoved(null)
      setProblem(errorMessage(error))
    })
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-2xl">Screenshots</h2>
        <span className="font-mono text-[11px] text-ink-soft">
          the first one is what people see first
        </span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (files.length > 0) void run(() => addMedia(game.id, files))
          event.target.value = ''
        }}
      />

      {order.length === 0 ? (
        <p className="mt-4 rounded-card border-2 border-dashed border-ink-faint px-5 py-6 font-body text-sm text-ink-soft">
          Nothing here yet. A listing with no screenshots is a listing nobody
          clicks.
        </p>
      ) : (
        <ul className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {order.map((item, index) => {
            const isCover = item.cid === game.coverCid
            return (
              <li
                key={item.id}
                className={cn(
                  'overflow-hidden rounded-card border-2 border-ink bg-paper',
                  isCover && 'shadow-hard',
                )}
              >
                <div className="relative aspect-16/10 bg-paper-sunk">
                  {item.kind === 'video' ? (
                    <video
                      src={item.url}
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img
                      src={item.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                  {isCover ? (
                    <span className="label-micro absolute top-2 left-2 rounded-chip border-2 border-ink bg-yellow px-2 py-0.5 text-ink">
                      Cover
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-1 border-t-2 border-ink px-2 py-1.5">
                  <IconButton
                    label="Move earlier"
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowLeft size={14} strokeWidth={2.5} />
                  </IconButton>
                  <IconButton
                    label="Move later"
                    disabled={busy || index === order.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowRight size={14} strokeWidth={2.5} />
                  </IconButton>

                  {item.kind === 'image' && !isCover ? (
                    <IconButton
                      label="Use as the cover"
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          editGame(game.id, { coverMediaId: item.id }),
                        )
                      }
                    >
                      <Star size={14} strokeWidth={2.5} />
                    </IconButton>
                  ) : null}

                  <IconButton
                    label="Remove"
                    disabled={busy}
                    className="ml-auto hover:text-red"
                    onClick={() => void run(() => removeMedia(game.id, item.id))}
                  >
                    <X size={14} strokeWidth={2.5} />
                  </IconButton>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Button
        variant="neutral"
        size="sm"
        className="mt-4"
        disabled={busy || order.length >= 8}
        onClick={() => fileRef.current?.click()}
      >
        {order.length >= 8 ? 'Eight is the limit' : 'Add screenshots'}
      </Button>

      {problem ? (
        <p role="alert" className="mt-3 font-body text-sm text-red">
          {problem}
        </p>
      ) : null}
    </section>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center justify-center rounded-chip border-0 bg-transparent p-1.5 text-ink-soft hover:text-ink disabled:cursor-default disabled:opacity-30',
        className,
      )}
    >
      {children}
    </button>
  )
}
