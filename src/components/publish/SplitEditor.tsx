import { Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Freehand } from '@/components/icons/Freehand'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export interface DraftMember {
  id: string
  /** Handle for you and for existing teammates; email for a new invite. */
  label: string
  role: string
  pct: number
  /** `you` — the publisher. `teammate` — already in the studio, added by name.
   *  `invite` — new to the studio, so an email is required. */
  kind: 'you' | 'teammate' | 'invite'
  /**
   * The studio membership this share belongs to, for a teammate picked off the
   * roster. The server pays whoever that row resolves to, so nothing here has
   * to know or guess anyone's wallet address.
   */
  memberId?: string
}

/** Someone already on the studio, as the roster knows them. */
export interface TeamMember {
  id: string
  handle: string
}

const BADGE = {
  you: { text: 'You', className: 'bg-yellow text-ink' },
  teammate: { text: 'On your team', className: 'bg-paper-sunk text-ink-soft' },
  invite: { text: 'Invited by email', className: 'bg-paper-sunk text-ink-soft' },
} as const

/** Deliberately loose — the server is the real validator. */
function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

const SEGMENT_COLOURS = [
  'bg-green',
  'bg-blue',
  'bg-pink',
  'bg-red',
  'bg-ink',
] as const

/**
 * Direct manipulation of the split: grab a divider and push percentage from
 * one person to the next. The number inputs below stay for precision — this is
 * for deciding, those are for finishing.
 *
 * Dragging conserves the total, so a bar that adds to 100 stays at 100. The
 * unassigned remainder is treated as one more slice, which means the last
 * divider pulls out of it rather than being a dead edge.
 */
function SplitDial({
  members,
  onChange,
}: {
  members: DraftMember[]
  onChange: (next: DraftMember[]) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    index: number
    startX: number
    width: number
    aStart: number
    bStart: number | null
    slack: number
  } | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)

  const total = members.reduce((sum, member) => sum + member.pct, 0)
  const remaining = 100 - total

  /** Move `amount` points across the divider that sits after member `index`. */
  function shiftAt(index: number, amount: number) {
    const bStart = index + 1 < members.length ? members[index + 1].pct : null
    const slack = bStart ?? Math.max(0, remaining)
    const aStart = members[index].pct
    const next = Math.max(0, Math.min(aStart + slack, aStart + amount))
    const moved = next - aStart
    if (moved === 0) return
    onChange(
      members.map((member, i) => {
        if (i === index) return { ...member, pct: next }
        if (bStart !== null && i === index + 1) {
          return { ...member, pct: bStart - moved }
        }
        return member
      }),
    )
  }

  function begin(event: React.PointerEvent<HTMLButtonElement>, index: number) {
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const bStart = index + 1 < members.length ? members[index + 1].pct : null
    drag.current = {
      index,
      startX: event.clientX,
      width: rect.width,
      aStart: members[index].pct,
      bStart,
      slack: bStart ?? Math.max(0, remaining),
    }
    setDragging(index)
  }

  function move(event: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current
    if (!d) return
    const delta = Math.round(((event.clientX - d.startX) / d.width) * 100)
    const next = Math.max(0, Math.min(d.aStart + d.slack, d.aStart + delta))
    const moved = next - d.aStart
    onChange(
      members.map((member, i) => {
        if (i === d.index) return { ...member, pct: next }
        if (d.bStart !== null && i === d.index + 1) {
          return { ...member, pct: d.bStart - moved }
        }
        return member
      }),
    )
  }

  function end(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    drag.current = null
    setDragging(null)
  }

  // A divider exists after every member that has something to trade with —
  // the next person, or the unassigned remainder.
  const dividers = members
    .map((_, i) => i)
    .filter((i) => i + 1 < members.length || remaining > 0)

  // Left edge of each divider, as a running total of the shares before it.
  const offsets = members.map((_, i) =>
    members.slice(0, i + 1).reduce((sum, member) => sum + member.pct, 0),
  )

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="label-micro text-ink-soft">What buyers will see</span>
        {dividers.length > 0 ? (
          <span className="font-mono text-[11px] text-ink-soft">
            Drag the dividers, or arrow-key them
          </span>
        ) : null}
      </div>

      <div
        ref={barRef}
        className="relative mt-2.5 h-12 rounded-chip border-2 border-ink shadow-hard-sm select-none"
      >
        <div className="flex h-full overflow-hidden rounded-chip">
          {members.map((member, i) => (
            <div
              key={member.id}
              style={{ flex: `0 0 ${member.pct}%` }}
              className={cn(
                'flex items-center justify-center overflow-hidden',
                SEGMENT_COLOURS[i % SEGMENT_COLOURS.length],
              )}
            >
              {member.pct >= 9 ? (
                <span className="font-mono tnum text-[13px] font-bold text-paper">
                  {member.pct}%
                </span>
              ) : null}
            </div>
          ))}
          {remaining > 0 ? (
            <div
              style={{ flex: `0 0 ${remaining}%` }}
              className="hatch flex items-center justify-center overflow-hidden"
            >
              {remaining >= 9 ? (
                <span className="font-mono tnum text-[13px] font-bold text-ink-soft">
                  {remaining}%
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {dividers.map((i) => (
          <button
            key={members[i].id}
            type="button"
            role="separator"
            aria-orientation="vertical"
            aria-label={`Share between ${members[i].label} and ${
              i + 1 < members.length ? members[i + 1].label : 'unassigned'
            }`}
            aria-valuenow={members[i].pct}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ left: `${offsets[i]}%` }}
            onPointerDown={(event) => begin(event, i)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 5 : 1
              if (event.key === 'ArrowLeft') {
                event.preventDefault()
                shiftAt(i, -step)
              } else if (event.key === 'ArrowRight') {
                event.preventDefault()
                shiftAt(i, step)
              }
            }}
            className={cn(
              'absolute top-1/2 z-10 flex h-[calc(100%+8px)] w-6 -translate-x-1/2 -translate-y-1/2',
              'cursor-col-resize touch-none items-center justify-center border-0 bg-transparent p-0',
            )}
          >
            <span
              className={cn(
                'flex h-full w-2.5 items-center justify-center rounded-full border-2 border-ink transition-colors',
                dragging === i ? 'bg-yellow' : 'bg-paper',
              )}
            >
              <span className="h-3 w-px bg-ink" />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * The splits editor. People you've shipped with before are added by name from
 * the studio roster; anyone new needs an email and claims a wallet on accept.
 * Requiring wallets up front would kill the jam-team case, which is the whole
 * reason this feature exists.
 *
 * Must total exactly 100 to publish. After publish there is no edit path
 * anywhere in this app, by design (DESIGN.md §9).
 */
export function SplitEditor({
  members,
  onChange,
  team = [],
}: {
  members: DraftMember[]
  onChange: (next: DraftMember[]) => void
  /** People already in this studio — addable by name, no email needed. */
  team?: TeamMember[]
}) {
  const [entry, setEntry] = useState('')
  const [role, setRole] = useState('')

  const total = members.reduce((sum, member) => sum + member.pct, 0)
  const remaining = 100 - total

  const added = new Set(members.map((member) => member.label.toLowerCase()))
  const available = team.filter(
    (person) => !added.has(person.handle.toLowerCase()),
  )

  const typed = entry.trim()
  const suggestions = typed
    ? available.filter((person) =>
        person.handle.toLowerCase().includes(typed.toLowerCase()),
      )
    : available

  const exactTeammate = available.find(
    (person) => person.handle.toLowerCase() === typed.toLowerCase(),
  )
  const isEmail = looksLikeEmail(typed)
  const canAdd = Boolean(exactTeammate) || isEmail

  function update(id: string, patch: Partial<DraftMember>) {
    onChange(
      members.map((member) =>
        member.id === id ? { ...member, ...patch } : member,
      ),
    )
  }

  function addPerson(label: string, kind: 'teammate' | 'invite', memberId?: string) {
    if (added.has(label.toLowerCase())) return
    onChange([
      ...members,
      {
        // Labels are unique by construction — duplicates are rejected above —
        // so they make a stable id without reaching for a clock or a counter.
        id: `m_${kind}_${label}`,
        label,
        role: role.trim() || 'contributor',
        pct: 0,
        kind,
        memberId,
      },
    ])
    setEntry('')
    setRole('')
  }

  function add() {
    if (exactTeammate) addPerson(exactTeammate.handle, 'teammate', exactTeammate.id)
    else if (isEmail) addPerson(typed, 'invite')
  }

  function splitEvenly() {
    const each = Math.floor(100 / members.length)
    onChange(
      members.map((member, i) => ({
        ...member,
        // The first person absorbs the rounding, so it always lands on 100.
        pct: i === 0 ? 100 - each * (members.length - 1) : each,
      })),
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <SplitDial members={members} onChange={onChange} />

      {/* Rows */}
      <ul className="flex list-none flex-col gap-2.5 p-0">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex flex-wrap items-center gap-3 rounded-card border-2 border-ink bg-paper px-3.5 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-[13px] font-semibold">
                  {member.label}
                </span>
                <span
                  className={cn(
                    'label-micro shrink-0 rounded-chip border-2 border-ink px-2 py-0.5',
                    BADGE[member.kind].className,
                  )}
                >
                  {BADGE[member.kind].text}
                </span>
              </div>
              <input
                value={member.role}
                onChange={(event) =>
                  update(member.id, { role: event.target.value })
                }
                aria-label={`Role for ${member.label}`}
                placeholder="what they did"
                className="mt-0.5 w-full bg-transparent font-mono text-[11px] text-ink-soft outline-none placeholder:text-ink-faint"
              />
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                value={member.pct}
                onChange={(event) =>
                  update(member.id, {
                    pct: Math.max(
                      0,
                      Math.min(100, Number(event.target.value) || 0),
                    ),
                  })
                }
                aria-label={`Percentage for ${member.label}`}
                className="w-16 rounded-card border-2 border-ink bg-paper px-2 py-1 text-right font-mono tnum text-[13px] font-bold outline-none focus:shadow-hard-sm"
              />
              <span className="font-mono text-[13px] text-ink-soft">%</span>

              {member.kind !== 'you' ? (
                <button
                  type="button"
                  onClick={() =>
                    onChange(members.filter((m) => m.id !== member.id))
                  }
                  aria-label={`Remove ${member.label}`}
                  className="ml-1 cursor-pointer rounded-card border-2 border-ink bg-paper p-1.5 text-ink-soft transition-transform duration-130 hover:-translate-y-px hover:text-pink active:translate-y-px"
                >
                  <Trash2 size={14} strokeWidth={2.5} />
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {/* Total */}
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-card border-2 px-4 py-2.5 font-mono text-[13px]',
          remaining === 0
            ? 'border-ink bg-green text-paper'
            : 'border-ink bg-paper-sunk text-ink',
        )}
      >
        <span className="font-bold">
          {remaining === 0
            ? 'Adds up to 100%'
            : remaining > 0
              ? `${remaining}% still to assign`
              : `${Math.abs(remaining)}% over`}
        </span>
        <div className="flex items-center gap-3">
          {members.length > 1 ? (
            <button
              type="button"
              onClick={splitEvenly}
              className={cn(
                'cursor-pointer border-0 bg-transparent font-mono text-[11px] underline underline-offset-2',
                remaining === 0 ? 'text-paper' : 'text-ink-soft',
              )}
            >
              Split evenly
            </button>
          ) : null}
          <span className="tnum font-bold">{total}%</span>
        </div>
      </div>

      {/* Add someone */}
      <div className="rounded-card border-2 border-ink bg-paper-sunk p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg">Add someone</h3>
            <p className="mt-1 max-w-[48ch] font-body text-[13px] leading-relaxed text-ink-soft">
              People you&rsquo;ve shipped with before go in by name. Anyone new
              needs an email. They claim a wallet when they accept.
            </p>
          </div>
          <Freehand
            name="business-deal-handshake"
            className="h-10 w-10 shrink-0 text-green"
          />
        </div>

        {available.length > 0 ? (
          <div className="mt-4">
            <span className="label-micro block text-ink-soft">
              {typed ? 'Matching your team' : 'Already on your team'}
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestions.length > 0 ? (
                suggestions.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => addPerson(person.handle, 'teammate', person.id)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-chip border-2 border-ink bg-paper px-3 py-1.5 font-mono text-[12px] font-semibold text-ink transition-transform duration-130 hover:-translate-y-px hover:bg-yellow active:translate-y-px"
                  >
                    <Plus size={12} strokeWidth={3} />
                    {person.handle}
                  </button>
                ))
              ) : (
                <span className="font-mono text-[11px] text-ink-soft">
                  Nobody on your team matches “{typed}”.
                </span>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2.5">
          <input
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && add()}
            placeholder={
              available.length > 0 ? 'name or email' : 'teammate@example.com'
            }
            aria-label="Teammate name or email"
            className="min-w-50 flex-1 rounded-card border-2 border-ink bg-paper px-3 py-2 font-body text-sm outline-none placeholder:text-ink-faint focus:shadow-hard-sm"
          />
          <input
            value={role}
            onChange={(event) => setRole(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && add()}
            placeholder="art"
            aria-label="Their role"
            className="w-28 rounded-card border-2 border-ink bg-paper px-3 py-2 font-body text-sm outline-none placeholder:text-ink-faint focus:shadow-hard-sm"
          />
          <Button variant="neutral" onClick={add} disabled={!canAdd}>
            {exactTeammate ? 'Add' : 'Invite'}
          </Button>
        </div>

        {typed && !canAdd ? (
          <p className="mt-2.5 font-mono text-[11px] text-ink-soft">
            {added.has(typed.toLowerCase())
              ? `${typed} is already on this game.`
              : `Nobody on your team is called “${typed}”. Use their email to invite them.`}
          </p>
        ) : null}
      </div>
    </div>
  )
}
