/**
 * Formatting for values that come off the ledger.
 *
 * Everything here renders into a mono context — see DESIGN.md §2. Martian Mono
 * is wide, so long values truncate rather than wrap, and the full value is
 * always kept available for a title attribute or copy affordance.
 */

/** `3` → `"$3.00"`, `0` → `"Free"`. */
export function formatPrice(usd: number): string {
  if (usd === 0) return 'Free'
  return `$${usd.toFixed(2)}`
}

/** `0x71C7…3e4F`. Never let a raw address wrap. DESIGN.md §9. */
export function truncateAddress(address: string, lead = 6, tail = 4): string {
  if (address.length <= lead + tail + 1) return address
  return `${address.slice(0, lead)}…${address.slice(-tail)}`
}

/**
 * ENS name first, studio name second, truncated address last.
 * A raw address must never appear where a name could go.
 */
export function displayIdentity(opts: {
  ens?: string
  name?: string
  address?: string
}): string {
  if (opts.ens) return opts.ens
  if (opts.name) return opts.name
  if (opts.address) return truncateAddress(opts.address)
  return 'Unknown'
}

/** Short relative time for reviews and sale rows. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime()
  const mins = Math.max(0, Math.round((now.getTime() - then) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.round(months / 12)}y ago`
}

/** `4 Sep 2026` */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** `1240` → `"1.2k"` — for play counts, never for money. */
export function compactCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(1)}m`
}
