import { Logo } from '@/components/Logo'

/**
 * TODO(attribution): the Streamline Freehand icons are CC BY 4.0, so a visible
 * credit linking to streamlinehq.com is required somewhere in the app before
 * this ships publicly. Removed from the footer on request, to be placed
 * elsewhere. See DESIGN.md §13.
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
