import { Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { NotificationBell } from '@/components/NotificationBell'
import { ProfileMenu } from '@/components/ProfileMenu'
import { cn } from '@/lib/utils'
import { useSession } from '@/mocks/session'

/**
 * Browsing never asks for auth (CLAUDE.md §1), so the only thing on the right
 * is you, and everything about you sits behind it. See ProfileMenu for why the
 * links live in a menu rather than spread across the bar.
 */
export function SiteHeader({
  search,
  onSearchChange,
}: {
  search?: string
  onSearchChange?: (value: string) => void
}) {
  const showSearch = typeof onSearchChange === 'function'
  const session = useSession()

  return (
    <header className="border-b-2 border-ink bg-paper-sunk">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-5 gap-y-3 px-6 py-3.5">
        <Link to="/" className="shrink-0 text-ink no-underline">
          <Logo markClassName="h-7 w-7" />
        </Link>

        {showSearch ? (
          <div className="order-3 flex min-w-50 flex-1 items-center gap-2 rounded-card border-2 border-ink bg-paper px-3 py-2 focus-within:shadow-hard-sm md:order-none">
            <Search size={17} strokeWidth={2.5} className="shrink-0 text-ink-soft" />
            <input
              value={search ?? ''}
              onChange={(event) => onSearchChange?.(event.target.value)}
              placeholder="Search games, studios, tags"
              aria-label="Search the catalog"
              className="w-full bg-transparent font-body text-sm text-ink outline-none placeholder:text-ink-faint"
            />
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex shrink-0 items-center gap-2.5">
          {session.signedIn ? <NotificationBell /> : null}
          <ProfileMenu />
        </div>
      </div>
    </header>
  )
}

/** Thin ink rule used to break long pages into printed registers. */
export function Rule({ className }: { className?: string }) {
  return <hr className={cn('h-0 border-0 border-t-2 border-ink', className)} />
}
