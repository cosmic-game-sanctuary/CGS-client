import { Check, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Freehand } from '@/components/icons/Freehand'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Sticker } from '@/components/ui/Sticker'
import { cn } from '@/lib/utils'
import { checkEnsName, createStudio } from '@/api/studios'
import { errorMessage } from '@/lib/api'
import { useDebounced } from '@/lib/useDebounced'
import { joinStudio, signIn, useSession } from '@/auth/session'

/**
 * Making a studio. You need one before you can publish, and it is the only
 * thing between signing in and shipping, so it stays one short screen.
 *
 * The ENS name is optional on purpose: the whole flow works on a raw address,
 * and a name you have to think of is a bad thing to put in front of someone
 * who came here to upload a game.
 */
export function StudioSetup({
  embedded = false,
  onDone,
}: {
  /** Rendered inside /publish rather than as its own page. */
  embedded?: boolean
  onDone?: () => void
}) {
  const session = useSession()
  const [name, setName] = useState('')
  const [label, setLabel] = useState('')
  const [bio, setBio] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  const defaultHandle = session.email?.split('@')[0] ?? 'you'
  const [handle, setHandle] = useState(defaultHandle)

  const cleanLabel = label.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')

  // Every check is a live call against the subregistry on Sepolia, so it waits
  // for typing to stop. Results carry the label they were fetched for, which
  // is what stops a slow answer for "tin" landing under "tinroof".
  const settledLabel = useDebounced(cleanLabel, 400)
  const [checked, setChecked] = useState<{
    label: string
    available: boolean
    fullName: string | null
  } | null>(null)
  /** The parent every label sits under, learned from the first answer. */
  const [ensParent, setEnsParent] = useState<string | null>(null)

  useEffect(() => {
    if (!settledLabel) return
    const controller = new AbortController()
    checkEnsName(settledLabel, controller.signal)
      .then((result) => {
        setChecked({
          label: settledLabel,
          available: result.available,
          fullName: result.fullName,
        })
        // The suffix is the same for every label, so it is remembered rather
        // than blinking out between checks. Set here, where the answer
        // arrives, rather than derived in an effect off the result.
        if (result.fullName) {
          setEnsParent(result.fullName.slice(settledLabel.length + 1))
        }
      })
      .catch(() => {
        // Unreachable is not the same as taken. Leave it unanswered rather
        // than telling someone a free name is gone.
      })
    return () => controller.abort()
  }, [settledLabel])

  const nameCheck = checked?.label === cleanLabel ? checked : null
  const checking = cleanLabel.length > 0 && nameCheck === null
  const taken = nameCheck?.available === false


  // A name still being checked blocks the button. Creating one that turns out
  // to be taken costs a failed chain transaction to find out.
  const ready =
    name.trim().length > 1 && handle.trim().length > 0 && !taken && !checking

  function create() {
    setBusy(true)
    setFailed(null)
    createStudio({
      name: name.trim(),
      handle: handle.trim(),
      bio: bio.trim() || undefined,
      ensSubname: cleanLabel || undefined,
    })
      .then(() => {
        // The studio is the server's now, so the session re-reads rather than
        // being told what to believe.
        joinStudio()
        onDone?.()
      })
      .catch((error: unknown) => setFailed(errorMessage(error)))
      .finally(() => setBusy(false))
  }

  const body = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Sticker className="-rotate-2">One time only</Sticker>
          <h1 className="mt-3 max-w-[16ch] text-[clamp(28px,4.2vw,42px)]">
            Name your studio.
          </h1>
          <p className="mt-3 max-w-[50ch] font-body text-[17px] leading-relaxed text-ink-soft">
            It goes on everything you publish, and it is what buyers see next to
            your games.
          </p>
        </div>
        <Freehand
          name="business-deal-handshake"
          className="hidden h-24 w-24 shrink-0 text-green sm:block"
        />
      </div>

      <div className="mt-8 flex flex-col gap-5">
        <div>
          <span className="label-micro block text-ink-soft">Studio name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Tin Roof"
            className="mt-2 w-full rounded-card border-2 border-ink bg-paper px-3.5 py-2.5 font-body text-base outline-none placeholder:text-ink-faint focus:shadow-hard-sm"
          />
        </div>

        <div>
          <span className="label-micro block text-ink-soft">Your handle</span>
          <span className="mt-0.5 block font-body text-[13px] text-ink-soft">
            What appears beside your share on every split.
          </span>
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder={defaultHandle}
            className="mt-2 w-full rounded-card border-2 border-ink bg-paper px-3.5 py-2.5 font-mono text-[15px] outline-none placeholder:text-ink-faint focus:shadow-hard-sm"
          />
        </div>

        <div>
          <span className="label-micro block text-ink-soft">
            Name on the network
          </span>
          <span className="mt-0.5 block font-body text-[13px] text-ink-soft">
            Optional. Skip it and your games show a wallet address instead.
          </span>
          <div
            className={cn(
              'mt-2 flex items-center gap-1 rounded-card border-2 bg-paper px-3.5 py-2.5 focus-within:shadow-hard-sm',
              taken ? 'border-pink' : 'border-ink',
            )}
          >
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="tinroof"
              aria-label="Your name on the network"
              className="min-w-0 flex-1 bg-transparent font-mono text-[15px] outline-none placeholder:text-ink-faint"
            />
            {ensParent ? (
              <span className="shrink-0 font-mono text-[15px] text-ink-soft">
                .{ensParent}
              </span>
            ) : null}
          </div>
          {cleanLabel ? (
            <p
              className={cn(
                'mt-2 flex items-center gap-1.5 font-mono text-[11px]',
                checking ? 'text-ink-soft' : taken ? 'text-pink' : 'text-green',
              )}
            >
              {checking ? (
                <>
                  <Loader2 size={12} strokeWidth={3} className="animate-spin" />
                  Checking {cleanLabel}
                </>
              ) : taken ? (
                <>
                  <X size={12} strokeWidth={3} />
                  {nameCheck?.fullName ?? cleanLabel} is taken
                </>
              ) : (
                <>
                  <Check size={12} strokeWidth={3} />
                  {nameCheck?.fullName ?? cleanLabel} is free
                </>
              )}
            </p>
          ) : null}
        </div>

        <div>
          <span className="label-micro block text-ink-soft">
            A line about you
          </span>
          <span className="mt-0.5 block font-body text-[13px] text-ink-soft">
            Optional.
          </span>
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={3}
            maxLength={240}
            placeholder="Three people, one jam, no publisher."
            className="mt-2 w-full resize-y rounded-card border-2 border-ink bg-paper px-3.5 py-2.5 font-body text-base leading-relaxed outline-none placeholder:text-ink-faint focus:shadow-hard-sm"
          />
        </div>

        <div className="flex flex-col gap-3 border-t-2 border-ink pt-5">
          <div className="flex flex-wrap items-center gap-4">
            <Button
              variant="primary"
              size="lg"
              disabled={!ready || busy}
              onClick={create}
            >
              {busy ? 'Making it…' : 'Create studio'}
            </Button>
            <span className="font-mono text-[11px] text-ink-soft">
              Been invited to one? It&rsquo;s in your notifications.
            </span>
          </div>

          {/* Claiming a name is a real transaction on a real network, and it
              takes about as long as one. Saying so is better than a spinner
              that looks stuck. */}
          {busy && cleanLabel ? (
            <p className="flex items-center gap-2 font-mono text-[11px] text-ink-soft">
              <Loader2 size={12} strokeWidth={3} className="animate-spin" />
              Claiming {cleanLabel}
              {ensParent ? `.${ensParent}` : ''}. This takes a few seconds.
            </p>
          ) : null}

          {failed ? (
            <p className="rounded-card border-2 border-ink border-l-8 border-l-red bg-paper-sunk px-4 py-3 font-body text-[13px] leading-relaxed">
              {failed}
            </p>
          ) : null}
        </div>
      </div>
    </>
  )

  // One studio per account, which the server enforces too. Landing here with
  // one already is a wrong turn, not an error, so it points at the one you
  // have rather than at a form that would be refused.
  const content = !session.ready ? (
    <div className="hatch h-64 rounded-card border-2 border-ink" />
  ) : !session.signedIn ? (
    <Detour
      title="Sign in first."
      body="A studio belongs to an account, so we need to know whose it is."
      action={
        <Button variant="primary" size="lg" onClick={() => signIn()}>
          Sign in
        </Button>
      }
    />
  ) : session.studioId ? (
    <Detour
      title="You already have a studio."
      body={`${session.studioName ?? 'It'} is yours. Everything you publish goes out under it.`}
      action={
        <ButtonLink
          to={`/studio/${session.studioId}`}
          variant="primary"
          size="lg"
        >
          Go to your studio
        </ButtonLink>
      }
    />
  ) : (
    body
  )

  if (embedded) return <div>{content}</div>

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-180 flex-1 px-6 py-10">
        {content}
      </main>
      <SiteFooter />
    </div>
  )
}

/** A wrong turn rather than a failure, so it points somewhere useful. */
function Detour({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-card border-2 border-ink bg-yellow px-7 py-9 shadow-hard md:flex-row md:items-center md:gap-8">
      <Freehand
        name="business-deal-handshake"
        className="h-20 w-20 shrink-0 text-ink"
      />
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-2xl">{title}</h1>
        <p className="max-w-[44ch] font-body text-[15px] text-ink">{body}</p>
        {action}
      </div>
    </div>
  )
}
