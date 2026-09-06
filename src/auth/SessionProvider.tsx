import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { errorMessage, setTokenSource } from '@/lib/api'
import { getMe, type WireMe } from '@/api/me'
import { SessionContext, sessionBridge, type SessionState } from '@/auth/session'

/**
 * Joins Privy's session to the server's answer for who that session is.
 *
 * Everything keyed to a user id rather than cleared on sign-out: a stale
 * result reads as absent during render, which is both simpler than clearing
 * state in an effect and impossible to get wrong when someone signs into a
 * second account without reloading.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy()

  // Bumped to force a re-read of /api/me: after funding, after a purchase,
  // after making a studio. Anything that changes what the server would say.
  const [refreshTick, setRefreshTick] = useState(0)
  const [loaded, setLoaded] = useState<{
    userId: string
    me: WireMe | null
    error: string | null
  } | null>(null)
  // Ownership the server has not caught up with yet. A GameKey mints a few
  // seconds after payment settles and the buyer is entitled to the game the
  // moment it does, so the listing shows owned immediately and the server's
  // answer takes over on the next read.
  const [justBought, setJustBought] = useState<{ userId: string; ids: string[] }>(
    { userId: '', ids: [] },
  )

  const userId = authenticated ? (user?.id ?? null) : null

  // Every request that carries a token reads it through here, at call time,
  // so a refresh is never missed and no component has to pass one down.
  useEffect(() => {
    setTokenSource(getAccessToken)
  }, [getAccessToken])

  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    getMe(controller.signal)
      .then((me) => setLoaded({ userId, me, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        // Signed into Privy but the server won't say who that is. Recorded
        // rather than swallowed, because every field below then sits at its
        // empty value and a broken account reads exactly like a new one.
        setLoaded({ userId, me: null, error: errorMessage(error) })
      })
    return () => controller.abort()
  }, [userId, refreshTick])

  const refresh = useCallback(() => setRefreshTick((n) => n + 1), [])

  const grantKey = useCallback(
    (gameId: string) => {
      if (!userId) return
      setJustBought((current) => {
        const ids = current.userId === userId ? current.ids : []
        return ids.includes(gameId)
          ? { userId, ids }
          : { userId, ids: [...ids, gameId] }
      })
    },
    [userId],
  )

  useEffect(() => {
    sessionBridge.login = login
    sessionBridge.logout = logout
    sessionBridge.refresh = refresh
    sessionBridge.grantKey = grantKey
  }, [login, logout, refresh, grantKey])

  const current = loaded?.userId === userId ? loaded : null
  const me = current?.me ?? null

  const value = useMemo<SessionState>(
    () => ({
      ready,
      signedIn: authenticated,
      // Privy knows the email before /api/me answers, so the header fills in
      // on the first frame rather than a beat later.
      email: me?.email ?? user?.email?.address ?? null,
      address: me?.evmAddress ?? null,
      hederaAccountId: me?.hederaAccountId ?? null,
      balanceUsd: me?.balanceUsd ?? 0,
      balanceUnits: me?.balanceUnits ? Number(me.balanceUnits) : 0,
      assetDecimals: me?.balanceAssetDecimals ?? 6,
      // Keyed to the user, so signing out or switching accounts cannot leave
      // the previous person's keys on screen.
      ownedGameIds:
        userId && justBought.userId === userId ? justBought.ids : [],
      studioId: me?.studio?.id ?? null,
      studioName: me?.studio?.name ?? null,
      handle: me?.studio?.handle ?? null,
      error: current?.error ?? null,
    }),
    [ready, authenticated, me, current, user, userId, justBought],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}
