import { Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSession } from '@/mocks/session'

/**
 * Browsing never asks for auth — CLAUDE.md §1. The control says "Sign in", not
 * "Connect wallet", and it is not the loudest thing on the page: DESIGN.md §9.
 */
export function SiteHeader({
  search,
  onSearchChange,
}: {
  search?: string
  onSearchChange?: (value: string) => void
}) {
  const session = useSession()
  const showSearch = typeof onSearchChange === 'function'

  return (
    <header className="border-b-2 border-ink bg-paper-sunk">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-5 gap-y-3 px-6 py-3.5">
        <Link to="/" className="shrink-0 text-ink no-underline">
          <Logo markClassName="h-7 w-7" />
        </Link>

        {showSearch ? (
          <div className="order-3 flex min-w-[200px] flex-1 items-center gap-2 rounded-card border-2 border-ink bg-paper px-3 py-2 focus-within:shadow-hard-sm md:order-none">
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

        <nav className="flex shrink-0 items-center gap-3">
          <Link
            to="/publish"
            className="font-wonk text-sm text-ink no-underline hover:underline"
          >
            Publish a game
          </Link>

          {session.signedIn ? (
            <span className="flex items-center gap-2.5 rounded-chip border-2 border-ink bg-paper px-3 py-1.5">
              <span
                className="max-w-[13ch] truncate font-mono text-[11px] text-ink-soft"
                title={session.email ?? undefined}
              >
                {session.email}
              </span>
              <span className="font-mono tnum text-[11px] font-bold text-green">
                {formatPrice(session.balanceUsd)}
              </span>
            </span>
          ) : (
            // TODO(integration): Privy login. Buying signs you in on the way
            // through, so this is a convenience, never a gate on browsing.
            <Button size="sm" variant="neutral">
              Sign in
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}

/** Thin ink rule used to break long pages into printed registers. */
export function Rule({ className }: { className?: string }) {
  return <hr className={cn('h-0 border-0 border-t-2 border-ink', className)} />
}
