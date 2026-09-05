import { useLocation } from 'react-router-dom'
import { Freehand } from '@/components/icons/Freehand'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { ButtonLink } from '@/components/ui/Button'

/**
 * Tone C, like the other empty states: a coloured ground and a full-size
 * freehand icon. Says what happened and offers the two things anyone who lands
 * here actually wants.
 *
 * A real page rather than a redirect, because silently bouncing someone to the
 * catalog hides a broken link instead of reporting it.
 */
export function NotFound() {
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-page flex-1 px-6 py-16">
        <div className="flex flex-col items-start gap-6 rounded-card border-2 border-ink bg-yellow px-8 py-10 shadow-hard md:flex-row md:items-center md:gap-9">
          <Freehand
            name="alerts-stop-sign"
            className="h-24 w-24 shrink-0 text-ink"
          />
          <div className="flex min-w-0 flex-col items-start gap-3">
            <h1 className="text-[clamp(28px,4.4vw,42px)]">
              Nothing at this address.
            </h1>
            <p className="max-w-[46ch] font-body text-[17px] leading-relaxed text-ink">
              The link may be wrong, or the page moved. If you were sent here
              from somewhere else, the sender probably has a stale link.
            </p>
            <p
              className="max-w-full truncate font-mono text-[11px] text-ink/70"
              title={pathname}
            >
              {pathname}
            </p>
            <div className="mt-1 flex flex-wrap gap-3">
              <ButtonLink to="/" variant="neutral">
                Browse the catalog
              </ButtonLink>
              <ButtonLink to="/library" variant="ghost">
                Your games
              </ButtonLink>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
