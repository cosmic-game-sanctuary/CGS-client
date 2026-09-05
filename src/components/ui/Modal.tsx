import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Dialog shell. Flat ink scrim, never a blur (DESIGN.md §9), paper panel
 * arriving with Stamp. Escape and the scrim both close it.
 */
export function Modal({
  title,
  eyebrow,
  onClose,
  children,
  size = 'md',
}: {
  title: string
  eyebrow?: string
  onClose: () => void
  children: ReactNode
  size?: 'md' | 'lg'
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-pointer border-0 bg-ink/45"
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={panelRef}
          tabIndex={-1}
          className={cn(
            // Header outside the scroll area, so the scrollbar never runs
            // alongside it or cuts into the rounded corner.
            'animate-stamp pointer-events-auto flex max-h-[86vh] w-full flex-col overflow-hidden rounded-card border-[3px] border-ink bg-paper shadow-hard-lg outline-none',
            size === 'md' ? 'max-w-[480px]' : 'max-w-[640px]',
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b-2 border-ink bg-paper-sunk px-5 py-3.5">
            <div className="min-w-0">
              {eyebrow ? (
                <span className="label-micro block text-ink-soft">{eyebrow}</span>
              ) : null}
              <h2 className="mt-0.5 text-xl">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="mt-0.5 shrink-0 cursor-pointer rounded-card border-2 border-ink bg-paper p-1.5 transition-transform duration-130 hover:-translate-y-px active:translate-y-px"
            >
              <X size={15} strokeWidth={3} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
