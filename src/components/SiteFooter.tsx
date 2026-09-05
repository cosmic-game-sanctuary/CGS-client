import { Logo } from '@/components/Logo'

/**
 * No credits here on purpose. The Freehand icons need a CC BY 4.0 attribution,
 * and it lives in the colophon at the bottom of "Why we built this" instead:
 * a page about how the thing was made, rather than a line under every shelf.
 * See `WhyModal.tsx` and DESIGN.md §13.
 */
export function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink bg-paper-sunk">
      <div className="mx-auto flex max-w-page flex-wrap items-end justify-between gap-x-10 gap-y-6 px-6 py-9">
        <Logo className="text-ink-soft" markClassName="h-6 w-6" />

        <p className="font-mono text-[11px] leading-relaxed text-ink-soft">
          All sales final. Splits lock at publish.
        </p>
      </div>
    </footer>
  )
}
