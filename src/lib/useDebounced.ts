import { useEffect, useState } from 'react'

/**
 * Holds a value still until typing settles.
 *
 * The search box used to hit an in-memory array, so a request per keystroke
 * cost nothing. It hits a real server now, and the server rate-limits, so
 * "hollowgrave" is one query rather than eleven.
 */
export function useDebounced<T>(value: T, ms = 250): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), ms)
    return () => window.clearTimeout(timer)
  }, [value, ms])

  return settled
}
