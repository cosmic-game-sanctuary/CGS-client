import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * React Router keeps the scroll position across navigations, so opening a
 * listing from halfway down the catalog dropped you halfway down the listing.
 * Reset to the top on every route change, and honour in-page hash links —
 * Router doesn't scroll to those on its own either.
 */
export function ScrollManager() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (hash) {
      const target = document.getElementById(hash.slice(1))
      if (target) {
        target.scrollIntoView({
          behavior: reduced ? 'auto' : 'smooth',
          block: 'start',
        })
        return
      }
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname, hash])

  return null
}
