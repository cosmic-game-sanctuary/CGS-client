import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  leaveStudio,
  removeMember,
  resendInvite,
  setMemberRole,
  transferStudio,
} from '@/api/studios'
import { errorMessage } from '@/lib/api'
import type { WireStudioMember } from '@/api/wire'

/**
 * Who is on the team right now.
 *
 * The roster and the credit ledger are separate things, and that separation is
 * the only reason removing someone is safe to offer. Every share ever paid or
 * held stays exactly where it is; this changes whether somebody is on the team
 * today, never what they earned. Anyone who has been credited is deactivated
 * rather than deleted, precisely so their money keeps its owner.
 *
 * The founder cannot be removed, demoted, or leave. They hand the studio over
 * instead, which is a different and more deliberate act.
 */
export function TeamRoster({
  studioId,
  members,
  canManage,
  isFounder,
  onChanged,
}: {
  studioId: string
  members: WireStudioMember[]
  /** The founder, or a member promoted to manager. */
  canManage: boolean
  isFounder: boolean
  onChanged: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  async function run(id: string, work: () => Promise<unknown>, said?: string) {
    setBusy(id)
    setProblem(null)
    setNote(null)
    try {
      await work()
      if (said) setNote(said)
      onChanged()
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const active = members.filter((m) => m.acceptedAt !== null)

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-2xl">The team</h2>
        <span className="font-mono text-[11px] text-ink-soft">
          {members.length} {members.length === 1 ? 'person' : 'people'}
        </span>
      </div>

      <ul className="mt-4 flex list-none flex-col gap-2 p-0">
        {members.map((member) => {
          const pending = member.acceptedAt === null
          const working = busy === member.id
          return (
            <li
              key={member.id}
              className="rounded-card border-2 border-ink bg-paper px-4 py-3"
            >
              <span className="block min-w-0">
                <span className="block truncate font-mono text-[13px] font-semibold">
                  {member.handle}
                </span>
                <span className="block truncate font-mono text-[11px] text-ink-soft">
                  {member.role === 'owner' ? 'manager' : 'member'}
                  {pending ? ' · has not accepted yet' : ''}
                  {member.email ? ` · ${member.email}` : ''}
                </span>
              </span>

              {canManage ? (
                <span className="mt-2.5 flex flex-wrap items-center gap-x-1 gap-y-1.5 border-t-2 border-paper-deep pt-2.5">
                  {pending ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={working}
                      onClick={() =>
                        void run(
                          member.id,
                          () => resendInvite(studioId, member.id),
                          `Invite sent again to ${member.handle}.`,
                        )
                      }
                    >
                      Resend invite
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={working}
                      onClick={() =>
                        void run(member.id, () =>
                          setMemberRole(
                            studioId,
                            member.id,
                            member.role === 'owner' ? 'member' : 'owner',
                          ),
                        )
                      }
                    >
                      {member.role === 'owner' ? 'Make member' : 'Make manager'}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={working}
                    onClick={() =>
                      void run(member.id, () => removeMember(studioId, member.id))
                    }
                  >
                    Remove
                  </Button>

                  {isFounder && !pending ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={working}
                      onClick={() =>
                        void run(
                          member.id,
                          () => transferStudio(studioId, member.id),
                          `${member.handle} owns this studio now.`,
                        )
                      }
                    >
                      Hand over
                    </Button>
                  ) : null}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>

      <p className="mt-3 font-mono text-[11px] leading-relaxed text-ink-soft">
        Removing somebody never touches what they earned. Every credit and every
        payout stays exactly where it is.
      </p>

      {!isFounder && active.length > 0 ? (
        <Button
          size="sm"
          variant="ghost"
          className="mt-3"
          disabled={busy !== null}
          onClick={() => void run('self', () => leaveStudio(studioId))}
        >
          Leave this studio
        </Button>
      ) : null}

      {note ? (
        <p className="mt-3 font-body text-sm text-green">{note}</p>
      ) : null}
      {problem ? (
        <p role="alert" className="mt-3 font-body text-sm text-red">
          {problem}
        </p>
      ) : null}
    </section>
  )
}
