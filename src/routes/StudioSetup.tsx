import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { Freehand } from '@/components/icons/Freehand'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { Button } from '@/components/ui/Button'
import { Sticker } from '@/components/ui/Sticker'
import { cn } from '@/lib/utils'
import { createStudio, ENS_PARENT, ensTaken } from '@/mocks/games'
import { joinStudio, useSession } from '@/auth/session'

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

  const defaultHandle = session.email?.split('@')[0] ?? 'you'
  const [handle, setHandle] = useState(defaultHandle)

  const cleanLabel = label.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
  const taken = cleanLabel.length > 0 && ensTaken(cleanLabel)
  const ready = name.trim().length > 1 && handle.trim().length > 0 && !taken

  function create() {
    setBusy(true)
    createStudio({
      name,
      ensLabel: cleanLabel || undefined,
      bio,
    })
      .then(() => {
        joinStudio()
        onDone?.()
      })
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
            <span className="font-mono text-[15px] text-ink-soft">
              .{ENS_PARENT}
            </span>
          </div>
          {cleanLabel ? (
            <p
              className={cn(
                'mt-2 flex items-center gap-1.5 font-mono text-[11px]',
                taken ? 'text-pink' : 'text-green',
              )}
            >
              {taken ? (
                <>
                  <X size={12} strokeWidth={3} />
                  {cleanLabel}.{ENS_PARENT} is taken
                </>
              ) : (
                <>
                  <Check size={12} strokeWidth={3} />
                  {cleanLabel}.{ENS_PARENT} is free
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

        <div className="flex flex-wrap items-center gap-4 border-t-2 border-ink pt-5">
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
      </div>
    </>
  )

  if (embedded) return <div>{body}</div>

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-180 flex-1 px-6 py-10">
        {body}
      </main>
      <SiteFooter />
    </div>
  )
}
