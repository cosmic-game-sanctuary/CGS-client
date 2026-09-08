import { useEffect, useState } from 'react'

/**
 * Time left on a deadline, as a string, re-rendered as it runs down.
 *
 * Its own file rather than sitting beside the banner that uses it, because a
 * module exporting both a component and a plain function breaks fast refresh
 * (`react-refresh/only-export-components`). Same reason `session.ts` is split
 * from `SessionProvider.tsx`.
 *
 * Null once the deadline has passed, which callers treat as "nothing to show"
 * rather than "zero". A sale ends on the server: the price reverts there, and
 * this clock reaching zero is a prediction of that, never the event itself.
 */
export function useCountdown(deadline: string): string | null {
  const target = new Date(deadline).getTime()
  // Read once at mount and then only ever from the interval below. Calling
  // `Date.now()` during render is impure, and React's lint rules are right to
  // refuse it: the value would change on any re-render for any reason.
  const [now, setNow] = useState(() => Date.now())

  const remaining = target - now
  const over = remaining <= 0
  // Per second under an hour. Above that the string does not change often
  // enough to be worth waking the page for, and a tab left open on a three-day
  // sale should not re-render a quarter of a million times.
  const fine = remaining < 60 * 60 * 1000

  useEffect(() => {
    if (over) return
    const timer = setInterval(() => setNow(Date.now()), fine ? 1000 : 30_000)
    return () => clearInterval(timer)
    // Only these two. `fine` flips exactly once, an hour out, which is when the
    // tick rate has to change, and `over` flips once at the end. `remaining`
    // changes every tick and would tear the interval down on each one.
  }, [fine, over])

  if (!Number.isFinite(target) || over) return null
  return formatRemaining(remaining)
}

/** `2d 4h`, `4h 12m`, `9m 30s`. One unit of precision below the largest. */
export function formatRemaining(ms: number): string {
  const total = Math.floor(ms / 1000)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}
