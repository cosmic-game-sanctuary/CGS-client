import { Banknote, Bell, Radar, Rocket, UserPlus } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatPrice, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  markAllRead,
  markRead,
  useNotifications,
  type AppNotification,
  type NotificationKind,
} from '@/mocks/notifications'

/**
 * The inbox, in the header.
 *
 * A panel and not a page, deliberately. Everything in here is a pointer at
 * something that already has a home: a listing, a studio, an invite. A
 * /notifications route would be a room you pass through on the way somewhere
 * else. See ProfileMenu for the rest of the information architecture.
 *
 * Rows animate with **Print** (DESIGN.md §4), which is the motion for a ledger
 * arriving. This is the first place it's used, and it's the right one: these
 * are receipts.
 */

/** Colour is meaning here, same as everywhere. DESIGN.md §1. */
const KIND: Record<
  NotificationKind,
  { icon: typeof Bell; className: string; label: string }
> = {
  sale: { icon: Banknote, className: 'bg-green text-paper', label: 'Sale' },
  invite: { icon: UserPlus, className: 'bg-pink text-paper', label: 'Invite' },
  agent: { icon: Radar, className: 'bg-blue text-paper', label: 'Agent' },
  live: { icon: Rocket, className: 'bg-ink text-paper', label: 'Published' },
}

export function NotificationBell() {
  const items = useNotifications()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const unread = items.filter((item) => !item.read).length

  useEffect(() => {
    if (!open) return
    function onDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function go(item: AppNotification) {
    markRead(item.id)
    setOpen(false)
    if (item.to) navigate(item.to)
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
        }
        className={cn(
          'relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-chip border-2 border-ink transition-[transform,box-shadow] duration-130 ease-out',
          open ? 'bg-ink text-paper' : 'bg-paper text-ink hover:-translate-y-px',
        )}
      >
        <Bell size={16} strokeWidth={2.5} />
        {unread > 0 ? (
          <span
            className={cn(
              'absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-chip border-2 border-ink bg-pink px-1',
              'font-mono tnum text-[9px] font-bold text-paper',
            )}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-stamp absolute top-[calc(100%+8px)] right-0 z-40 flex w-[min(21rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-card border-2 border-ink bg-paper shadow-hard-lg"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-ink bg-paper-sunk px-4 py-2.5">
            <span className="label-micro text-ink-soft">Notifications</span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[11px] text-ink-soft underline underline-offset-2 hover:text-ink"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center font-body text-[13px] text-ink-soft">
              Nothing yet. Sales, invites and anything your agents do turn up
              here.
            </p>
          ) : (
            <ul className="print-rows m-0 flex max-h-[24rem] list-none flex-col overflow-y-auto p-0">
              {items.map((item, i) => (
                <Row
                  key={item.id}
                  item={item}
                  onGo={() => go(item)}
                  style={{ '--i': i } as CSSProperties}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

function Row({
  item,
  onGo,
  style,
}: {
  item: AppNotification
  onGo: () => void
  style?: CSSProperties
}) {
  const kind = KIND[item.kind]
  const Icon = kind.icon

  return (
    <li style={style} className="border-b-2 border-ink/10 last:border-b-0">
      <button
        type="button"
        role="menuitem"
        onClick={onGo}
        className={cn(
          'flex w-full cursor-pointer items-start gap-3 border-0 px-4 py-3 text-left transition-colors',
          item.read ? 'bg-transparent' : 'bg-yellow/25',
          'hover:bg-paper-sunk',
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-chip border-2 border-ink',
            kind.className,
          )}
          aria-label={kind.label}
        >
          <Icon size={13} strokeWidth={2.75} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                'min-w-0 truncate font-wonk text-[14px] text-ink',
                !item.read && 'font-extrabold',
              )}
            >
              {item.title}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-ink-soft">
              {timeAgo(item.at)}
            </span>
          </span>
          {item.detail ? (
            <span className="mt-0.5 block font-body text-[12px] leading-snug text-ink-soft">
              {item.detail}
            </span>
          ) : null}
          {item.amountUsd !== undefined ? (
            <span className="mt-1 block font-mono tnum text-[13px] font-bold text-green">
              +{formatPrice(item.amountUsd)}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  )
}
