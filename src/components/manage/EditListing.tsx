import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { editGame, type WireManageView } from '@/api/manage'
import { errorMessage } from '@/lib/api'
import { formatPrice } from '@/lib/format'
import { useSession } from '@/auth/session'

/**
 * Editing a live listing, price included.
 *
 * Repricing is not a small feature here. A wishlist agent fires on a price
 * message on the public topic, and publishing writes exactly one of those per
 * game ever — so until this existed, an agent armed on a live listing could
 * never fire at all. That is why the announcement is surfaced rather than
 * assumed: "the price changed" and "the change is public" are different facts,
 * and only the second one an agent can act on.
 */
export function EditListing({
  view,
  onSaved,
}: {
  view: WireManageView
  onSaved: () => void
}) {
  const session = useSession()
  const { game } = view

  const [title, setTitle] = useState(game.title)
  const [tagline, setTagline] = useState(game.tagline)
  const [description, setDescription] = useState(game.description)
  const [tags, setTags] = useState(game.tags.join(', '))
  const [price, setPrice] = useState(String(game.priceUsd))
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [announced, setAnnounced] = useState<boolean | null>(null)

  const decimals = game.priceAssetDecimals || session.assetDecimals
  const typedUsd = Number(price)
  const validPrice = Number.isFinite(typedUsd) && typedUsd >= 0
  // Integer units for anything that moves money. The float is what someone
  // typed; it never reaches the API.
  const priceUnits = validPrice ? Math.round(typedUsd * 10 ** decimals) : null

  const nextTags = tags
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)

  const dirty =
    title !== game.title ||
    tagline !== game.tagline ||
    description !== game.description ||
    nextTags.join(',') !== game.tags.join(',') ||
    (priceUnits !== null && priceUnits !== game.priceUnits)

  async function save() {
    if (priceUnits === null) return
    setSaving(true)
    setProblem(null)
    setAnnounced(null)
    try {
      const result = await editGame(game.id, {
        // Only what changed. The server treats every field as optional and a
        // no-op write on the price would announce a drop that never happened.
        ...(title !== game.title ? { title } : {}),
        ...(tagline !== game.tagline ? { tagline } : {}),
        ...(description !== game.description ? { description } : {}),
        ...(nextTags.join(',') !== game.tags.join(',') ? { tags: nextTags } : {}),
        ...(priceUnits !== game.priceUnits ? { priceUnits } : {}),
      })
      if (priceUnits !== game.priceUnits) setAnnounced(result.announced ?? false)
      onSaved()
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const cheaper = priceUnits !== null && priceUnits < game.priceUnits

  return (
    <section className="mt-10">
      <h2 className="text-2xl">The listing</h2>
      <p className="mt-2 font-body text-[15px] text-ink-soft">
        The address never changes, even if the title does. Existing links keep
        working.
      </p>

      <div className="mt-5 flex flex-col gap-4 rounded-card border-2 border-ink bg-paper-sunk p-5">
        <Field label="Title">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            className={input}
          />
        </Field>

        <Field label="Tagline">
          <input
            value={tagline}
            onChange={(event) => setTagline(event.target.value)}
            maxLength={200}
            className={input}
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={6}
            maxLength={5000}
            className={`${input} resize-y leading-relaxed`}
          />
        </Field>

        <Field label="Tags" hint="Comma separated.">
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            className={input}
          />
        </Field>

        <Field
          label="Price"
          hint={cheaper ? 'Lower than now, so everyone waiting is told.' : 'USDC.'}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[15px] text-ink-soft">$</span>
            <input
              value={price}
              inputMode="decimal"
              onChange={(event) => setPrice(event.target.value)}
              className={`${input} max-w-40 font-mono`}
            />
            <span className="font-mono text-[11px] text-ink-soft">
              now {formatPrice(game.priceUsd)}
            </span>
          </div>
          {!validPrice ? (
            <p className="mt-1.5 font-mono text-[11px] text-red">
              That is not a price.
            </p>
          ) : null}
        </Field>

        <div className="flex flex-wrap items-center gap-3 border-t-2 border-ink pt-4">
          <Button
            variant="primary"
            disabled={!dirty || !validPrice || saving}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          {cheaper && dirty ? (
            <span className="font-mono text-[11px] text-ink-soft">
              Everyone with this on their wishlist gets told.
            </span>
          ) : null}
        </div>

        {announced !== null ? (
          <p
            className={`font-body text-sm ${announced ? 'text-green' : 'text-ink-soft'}`}
          >
            {announced
              ? 'The new price is public. Agents watching this game can see it.'
              : 'Saved, but the new price has not reached the public topic yet, so agents cannot see it.'}
          </p>
        ) : null}

        {problem ? (
          <p role="alert" className="font-body text-sm text-red">
            {problem}
          </p>
        ) : null}
      </div>
    </section>
  )
}

const input =
  'w-full rounded-card border-2 border-ink bg-paper px-3.5 py-2.5 font-body text-[15px] outline-none placeholder:text-ink-faint focus:shadow-hard-sm'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <span className="label-micro block text-ink-soft">
        {label}
        {hint ? <span className="ml-2 normal-case">{hint}</span> : null}
      </span>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}
