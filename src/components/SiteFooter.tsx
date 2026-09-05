import { Logo } from '@/components/Logo'

/**
 * Streamline attribution is required by CC BY 4.0 and must stay here —
 * DESIGN.md §13. It is the entire licence cost of the icon set.
 */
export function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink bg-paper-sunk">
      <div className="mx-auto flex max-w-page flex-wrap items-end justify-between gap-x-10 gap-y-6 px-6 py-9">
        <Logo className="text-ink-soft" markClassName="h-6 w-6" />

        <p className="font-mono text-[11px] leading-relaxed text-ink-soft">
          All sales final. Splits lock at publish.
          <br />
          Icons by{' '}
          <a href="https://streamlinehq.com" className="text-ink">
            Streamline
          </a>{' '}
          — Freehand, CC BY 4.0.
        </p>
      </div>
    </footer>
  )
}
