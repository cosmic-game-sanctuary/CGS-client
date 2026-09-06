import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { GameCard, GameCardSkeleton } from '@/components/GameCard'
import { HeroCollage } from '@/components/HeroCollage'
import { WhyModal } from '@/components/WhyModal'
import { Freehand } from '@/components/icons/Freehand'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Reveal } from '@/components/ui/Reveal'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/api'
import { useDebounced } from '@/lib/useDebounced'
import { listGames, tagsFrom } from '@/api/games'
import type { Game, SortKey } from '@/mocks/types'

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'newest', label: 'Newest' },
  { key: 'rating', label: 'Best rated' },
  { key: 'price-low', label: 'Cheapest' },
  { key: 'price-high', label: 'Priciest' },
]

export function Catalog() {
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<string | undefined>()
  const [sort, setSort] = useState<SortKey>('newest')
  const [freeOnly, setFreeOnly] = useState(false)
  const [whyOpen, setWhyOpen] = useState(false)
  // The unfiltered catalog, read once. Two things need the shape of the whole
  // store rather than the current results: the tag row, which would otherwise
  // shrink to whatever you already filtered by, and the hero fan.
  const [base, setBase] = useState<Game[] | null>(null)
  // Results are tagged with the query that produced them. Anything stale reads
  // as "still loading" during render, so the effect never has to setState
  // synchronously to clear the old list. A failure rides along in the same
  // object for the same reason.
  const [result, setResult] = useState<{
    key: string
    games: Game[]
    error: string | null
  } | null>(null)

  // One request when typing settles, not one per keystroke. The catalog used
  // to filter an array in memory, where that cost nothing.
  const settledSearch = useDebounced(search)
  const queryKey = JSON.stringify({ search: settledSearch, tag, sort, freeOnly })

  useEffect(() => {
    const controller = new AbortController()
    listGames(
      { search: settledSearch, tag, sort, freeOnly, limit: 60 },
      controller.signal,
    )
      .then(({ games }) => setResult({ key: queryKey, games, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setResult({ key: queryKey, games: [], error: errorMessage(error) })
      })
    return () => controller.abort()
  }, [queryKey, settledSearch, tag, sort, freeOnly])

  useEffect(() => {
    const controller = new AbortController()
    listGames({ limit: 60 }, controller.signal)
      .then(({ games }) => setBase(games))
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const tags = useMemo(() => tagsFrom(base ?? []).slice(0, 9), [base])

  const current = result?.key === queryKey ? result : null
  const games = current?.error ? null : (current?.games ?? null)
  const loadError = current?.error ?? null

  const filtered = tag !== undefined || freeOnly || search.trim() !== ''

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={search} onSearchChange={setSearch} />

      {/* Masthead — Tone C: coloured ground, rotation allowed, no cover art to
          fight. Left-aligned and asymmetric, never a centred hero. §6, §9 */}
      <section className="overflow-hidden border-b-2 border-ink bg-yellow">
        <div className="mx-auto grid max-w-page items-center gap-10 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-14">
          <div>
            <h1 className="max-w-[15ch] text-[clamp(36px,5.6vw,60px)] text-ink">
              The money goes where you think it goes.
            </h1>
            <p className="mt-5 max-w-[46ch] font-body text-[17px] leading-relaxed text-ink">
              Buy an indie game here and everyone who made it gets their share
              the same minute, split the way they agreed before the first
              sale.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <ButtonLink to="#catalog" variant="primary" size="lg" className="rotate-1">
                Browse the catalog
              </ButtonLink>
              <Button
                variant="neutral"
                size="lg"
                onClick={() => setWhyOpen(true)}
              >
                Why we built this
              </Button>
            </div>
          </div>

          <HeroCollage games={base ?? []} className="lg:justify-self-end" />
        </div>
      </section>

      {/* Filters */}
      <section className="border-b-2 border-ink bg-paper">
        <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-6 gap-y-4 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-micro mr-1 text-ink-soft">Tags</span>
            <FilterChip active={tag === undefined} onClick={() => setTag(undefined)}>
              All
            </FilterChip>
            {tags.map((name) => (
              <FilterChip
                key={name}
                active={tag === name}
                onClick={() => setTag(tag === name ? undefined : name)}
              >
                {name}
              </FilterChip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="label-micro mr-1 text-ink-soft">Sort</span>
            {SORTS.map((option) => (
              <FilterChip
                key={option.key}
                active={sort === option.key}
                onClick={() => setSort(option.key)}
              >
                {option.label}
              </FilterChip>
            ))}
            <FilterChip
              active={freeOnly}
              tone="green"
              onClick={() => setFreeOnly(!freeOnly)}
            >
              Free only
            </FilterChip>
          </div>
        </div>
      </section>

      {/* Grid */}
      <main id="catalog" className="mx-auto w-full max-w-page flex-1 px-6 py-10">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="text-2xl">
            {freeOnly ? 'Free to play' : tag ? `Tagged ${tag}` : 'Everything'}
          </h2>
          <span className="font-mono tnum text-xs text-ink-soft">
            {loadError
              ? 'unavailable'
              : games === null
                ? 'loading…'
                : `${games.length} games`}
          </span>
        </div>

        {loadError ? (
          <LoadFailed message={loadError} />
        ) : games === null ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(224px,1fr))] gap-5">
            {Array.from({ length: 8 }, (_, i) => (
              <GameCardSkeleton key={i} />
            ))}
          </div>
        ) : games.length === 0 ? (
          <EmptyState
            filtered={filtered}
            onClear={() => {
              setSearch('')
              setTag(undefined)
              setFreeOnly(false)
            }}
          />
        ) : (
          <Reveal className="grid grid-cols-[repeat(auto-fill,minmax(224px,1fr))] gap-5">
            {games.map((game, i) => (
              <GameCard
                key={game.id}
                game={game}
                style={{ '--i': i } as CSSProperties}
              />
            ))}
          </Reveal>
        )}
      </main>

      <SiteFooter />

      {whyOpen ? <WhyModal onClose={() => setWhyOpen(false)} /> : null}
    </div>
  )
}

function FilterChip({
  active,
  tone = 'ink',
  onClick,
  children,
}: {
  active: boolean
  tone?: 'ink' | 'green'
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'label-micro cursor-pointer rounded-chip border-2 border-ink px-2.5 py-1',
        'transition-transform duration-130 ease-out hover:-translate-y-px active:translate-y-px',
        active && tone === 'ink' && 'bg-ink text-paper',
        active && tone === 'green' && 'bg-green text-paper',
        !active && 'bg-paper text-ink',
      )}
    >
      {children}
    </button>
  )
}

/**
 * The store being unreachable is a different thing from the store being empty,
 * and saying so is the difference between "try again" and "there is nothing
 * here". Red, because it is the one state the reader has to act on.
 */
function LoadFailed({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-card border-2 border-ink bg-paper-sunk px-7 py-9 shadow-hard md:flex-row md:items-center md:gap-8">
      <Freehand name="alerts-stop-sign" className="h-20 w-20 shrink-0 text-red" />
      <div className="flex flex-col items-start gap-3">
        <h3 className="text-2xl">The catalog would not load.</h3>
        <p className="max-w-[46ch] font-body text-[15px] text-ink">{message}</p>
        <Button
          variant="neutral"
          size="sm"
          onClick={() => window.location.reload()}
        >
          Try again
        </Button>
      </div>
    </div>
  )
}

/** Tone C — a coloured ground and a full-size Freehand icon. DESIGN.md §6, §8. */
function EmptyState({
  filtered,
  onClear,
}: {
  filtered: boolean
  onClear: () => void
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-card border-2 border-ink bg-yellow px-7 py-9 shadow-hard md:flex-row md:items-center md:gap-8">
      <Freehand name="search-magnifier" className="h-20 w-20 text-ink" />
      <div className="flex flex-col items-start gap-3">
        <h3 className="text-2xl">Nothing here yet.</h3>
        <p className="max-w-[46ch] font-body text-[15px] leading-relaxed text-ink">
          {filtered
            ? 'No game matches those filters. Loosen one and something will turn up.'
            : 'The catalog is empty. If you make browser games, this is a good moment to be first.'}
        </p>
        {filtered ? (
          <Button size="sm" variant="neutral" onClick={onClear}>
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  )
}
