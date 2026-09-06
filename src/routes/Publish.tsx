import { Check, Shuffle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BuildFrame } from '@/components/BuildFrame'
import { BuildDiagnostics } from '@/components/publish/BuildStatus'
import { CoverArt } from '@/components/CoverArt'
import { Dropzone, type UploadedBuild } from '@/components/publish/Dropzone'
import { MediaPicker } from '@/components/publish/MediaPicker'
import {
  SplitEditor,
  type DraftMember,
} from '@/components/publish/SplitEditor'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { PriceChip } from '@/components/ui/PriceChip'
import { Sticker } from '@/components/ui/Sticker'
import {
  BuildError,
  mountBuild,
  unmountBuild,
  type MountedBuild,
  type MountStage,
} from '@/lib/buildPreview'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/api'
import { getStudio } from '@/api/games'
import { publishDraft, uploadGame, type SplitInput } from '@/api/publish'
import { useSession } from '@/auth/session'
import { StudioSetup } from '@/routes/StudioSetup'
import type { MediaItem, Studio } from '@/mocks/types'

/**
 * Dev upload. Priority 2 in the brief: drag a zip → **see it playing in the
 * page before publishing** → price → teammates by email → splits → publish.
 *
 * The preview gate is the point. It's the moment a dev decides to trust the
 * platform, so the build runs before anything is asked of them.
 *
 * No backend: the build is read for its name and size only, and publishing
 * pushes into the in-memory catalog so the flow lands somewhere real.
 */

const STEPS = ['Build', 'Details', 'Splits', 'Publish'] as const
type StepIndex = 0 | 1 | 2 | 3

export function Publish() {
  const navigate = useNavigate()
  const session = useSession()
  const [step, setStep] = useState<StepIndex>(0)

  // You publish as a studio, so making one comes first. Everything below is
  // written assuming it exists. The studio itself comes from `/api/me` now;
  // the rest of this screen is still on mocks until its own workflow.
  const myStudio: Studio | undefined = useMemo(
    () =>
      session.studioId
        ? {
            id: session.studioId,
            name: session.studioName ?? 'your studio',
            address: session.address ?? '',
            memberCount: 1,
          }
        : undefined,
    [session.studioId, session.studioName, session.address],
  )
  const myHandle = session.handle ?? 'you'

  const [build, setBuild] = useState<UploadedBuild | null>(null)
  const [mounted, setMounted] = useState<MountedBuild | null>(null)
  const [unpacking, setUnpacking] = useState(false)
  const [buildError, setBuildError] = useState<string | null>(null)
  const [stage, setStage] = useState<MountStage | null>(null)
  const [frameLoaded, setFrameLoaded] = useState(false)

  const [title, setTitle] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [tagText, setTagText] = useState('')
  const [coverSeed, setCoverSeed] = useState(() =>
    Math.floor(Math.random() * 64),
  )

  const [media, setMedia] = useState<MediaItem[]>([])
  const [coverId, setCoverId] = useState<string | null>(null)

  const [free, setFree] = useState(false)
  const [price, setPrice] = useState('3.00')

  const [members, setMembers] = useState<DraftMember[]>([
    { id: 'm_owner', label: myHandle, role: 'code', pct: 100, kind: 'you' },
  ])
  // The people already on this studio, so they can be added by name with no
  // email and no address. Comes from the roster rather than from past splits:
  // a member who joined but hasn't shipped yet is still someone you can credit.
  const [team, setTeam] = useState<Array<{ id: string; handle: string }>>([])
  useEffect(() => {
    if (!myStudio) return
    const controller = new AbortController()
    getStudio(myStudio.id, controller.signal)
      .then((profile) =>
        setTeam(
          (profile?.members ?? [])
            .filter((member) => member.handle !== myHandle)
            .map((member) => ({ id: member.id, handle: member.handle })),
        ),
      )
      .catch(() => {})
    return () => controller.abort()
  }, [myStudio, myHandle])

  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  // A draft that uploaded but hasn't been published. Kept so a failure on the
  // second call doesn't re-upload the build on retry — it is already pinned.
  const [draft, setDraft] = useState<{
    id: string
    slug: string
    invited: Array<{ id: string; email: string; handle: string }>
  } | null>(null)
  const [published, setPublished] = useState<{
    id: string
    slug: string
    title: string
    splitCount: number
  } | null>(null)
  const [sent, setSent] = useState<Array<{ id: string; email: string }>>([])

  // Steps change state, not the route, so ScrollManager never sees them —
  // without this you land halfway down the next step.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [step])

  const tags = tagText
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)

  const priceUsd = free ? 0 : Math.max(0, Number(price) || 0)
  const splitTotal = members.reduce((sum, member) => sum + member.pct, 0)

  // A price is typed in dollars and stored in the asset's smallest units.
  // Rounded rather than truncated, so 2.99 doesn't quietly become 2.98.
  const toUnits = (usd: number) =>
    Math.round(usd * 10 ** session.assetDecimals)

  // Only the files the picker actually holds go up. Anything without one came
  // from somewhere else and has nothing to upload.
  const mediaFiles = media
    .map((item) => item.file)
    .filter((file) => file !== undefined)
  const coverIndex = (() => {
    if (!coverId) return undefined
    const index = media.findIndex((item) => item.id === coverId)
    return index >= 0 && media[index]?.file ? index : undefined
  })()

  const canLeaveBuild = build !== null
  const canLeaveDetails = title.trim() !== '' && tagline.trim() !== ''
  const canLeaveSplits = splitTotal === 100

  // Unpacks the zip in the browser and mounts it so it actually runs below.
  function handleBuild(file: File) {
    setUnpacking(true)
    setBuildError(null)
    setFrameLoaded(false)
    mountBuild(file, setStage)
      .then((result) => {
        setMounted(result)
        setBuild({ name: file.name, sizeKb: Math.round(file.size / 1024), file })
        if (!title.trim()) {
          setTitle(guessTitle(file.name))
        }
      })
      .catch((error: unknown) => {
        setBuildError(
          error instanceof BuildError
            ? error.message
            : 'That build would not open. Is it a zip with an index.html inside?',
        )
      })
      .finally(() => {
        setUnpacking(false)
        setStage(null)
      })
  }

  function replaceBuild() {
    if (mounted) void unmountBuild(mounted.id)
    setMounted(null)
    setBuild(null)
    setFrameLoaded(false)
  }

  /**
   * How the editor's three kinds of person become something the server can
   * pay. Only the first has an address; the other two name a person and let
   * the server work out where their money goes, now or when they claim it.
   */
  function toSplitInput(member: DraftMember): SplitInput {
    const base = { role: member.role, pct: member.pct }
    if (member.kind === 'invite') {
      return {
        ...base,
        email: member.label,
        handle: member.label.split('@')[0] || member.label,
      }
    }
    if (member.kind === 'teammate' && member.memberId) {
      return { ...base, studioMemberId: member.memberId, handle: member.label }
    }
    return { ...base, wallet: session.address ?? undefined, handle: member.label }
  }

  async function handlePublish() {
    if (!myStudio || !build?.file) return
    setPublishing(true)
    setPublishError(null)

    try {
      // Upload first, unless a previous attempt already got this far. The
      // build is pinned to IPFS by that call, and re-sending it would pin a
      // second copy of a game that already exists as a draft.
      let current = draft
      if (!current) {
        const uploaded = await uploadGame({
          studioId: myStudio.id,
          title: title.trim(),
          tagline: tagline.trim(),
          description: description.trim() || tagline.trim(),
          tags: tags.length ? tags : ['unsorted'],
          priceUnits: toUnits(priceUsd),
          splits: members.map(toSplitInput),
          build: build.file,
          media: mediaFiles,
          coverMediaIndex: coverIndex,
        })
        current = {
          id: uploaded.id,
          slug: uploaded.slug,
          invited: uploaded.invited ?? [],
        }
        setDraft(current)
      }

      // The irreversible half: locks the splits, mints the token, writes the
      // public listing.
      const game = await publishDraft(current.id)

      setSent(current.invited.map((i) => ({ id: i.id, email: i.email })))
      setPublished({
        id: game.id,
        slug: game.slug,
        title: game.title,
        splitCount: members.length,
      })
    } catch (error) {
      setPublishError(errorMessage(error))
    } finally {
      setPublishing(false)
    }
  }

  if (!myStudio) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-10">
          <p className="label-micro mb-6 text-ink-soft">
            Step 0 of 4 · your studio
          </p>
          <StudioSetup embedded />
        </main>
        <SiteFooter />
      </div>
    )
  }

  if (published) {
    return (
      <Published
        game={published}
        studioId={myStudio.id}
        invites={sent}
        onGo={() => navigate(`/game/${published.slug}`)}
      />
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-215 flex-1 px-6 py-9">
        <h1 className="text-[clamp(30px,4.4vw,42px)]">Publish a game</h1>
        <p className="mt-2 max-w-[54ch] font-body text-ink-soft">
          Four steps. You&rsquo;ll see it running before you commit to anything.
        </p>

        <Stepper
          step={step}
          reached={{
            1: canLeaveBuild,
            2: canLeaveBuild && canLeaveDetails,
            3: canLeaveBuild && canLeaveDetails && canLeaveSplits,
          }}
          onGo={setStep}
        />

        <div className="mt-8">
          {step === 0 ? (
            <section className="flex flex-col gap-5">
              {build ? (
                <BuildPreview
                  build={build}
                  mounted={mounted}
                  title={title || 'Your build'}
                  coverSeed={coverSeed}
                  loaded={frameLoaded}
                  onFrameLoad={() => setFrameLoaded(true)}
                  onReplace={replaceBuild}
                />
              ) : (
                <Dropzone
                  onBuild={handleBuild}
                  busy={unpacking}
                  stage={stage}
                  error={buildError}
                />
              )}
            </section>
          ) : step === 1 ? (
            <section className="flex flex-col gap-5">
              <Field label="Title" hint="What it's called on the shelf.">
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Hollowgrave"
                  className={inputClass}
                />
              </Field>

              <Field label="Tagline" hint="One line. It sits under the title.">
                <input
                  value={tagline}
                  onChange={(event) => setTagline(event.target.value)}
                  placeholder="Dig down. Something is already there."
                  className={inputClass}
                />
              </Field>

              <Field label="Description" hint="Optional. Blank lines make paragraphs.">
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={6}
                  placeholder="A one-button descent into a mine that keeps getting deeper than it should."
                  className={cn(inputClass, 'resize-y leading-relaxed')}
                />
              </Field>

              <Field label="Tags" hint="Comma separated.">
                <input
                  value={tagText}
                  onChange={(event) => setTagText(event.target.value)}
                  placeholder="roguelike, atmospheric, one-button"
                  className={inputClass}
                />
                {tags.length ? (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="label-micro rounded-chip border-2 border-ink bg-paper px-2.5 py-1 text-ink-soft"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Field>

              <Field
                label="Screenshots and clips"
                hint="Images and video. Star one to make it the cover."
              >
                <MediaPicker
                  items={media}
                  coverId={coverId}
                  onChange={setMedia}
                  onPickCover={setCoverId}
                />
              </Field>

              {!coverId ? (
                <Field
                  label="Cover"
                  hint="Generated until you add art of your own."
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="w-40 overflow-hidden rounded-card border-2 border-ink shadow-hard">
                      <CoverArt seed={coverSeed} />
                    </div>
                    <Button
                      variant="neutral"
                      size="sm"
                      onClick={() => setCoverSeed((seed) => seed + 1)}
                    >
                      <Shuffle size={14} strokeWidth={2.5} />
                      Shuffle
                    </Button>
                  </div>
                </Field>
              ) : null}

              <Field label="Price" hint="USDC. Free games still mint a key.">
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    className={cn(
                      'flex items-center gap-1 rounded-card border-2 border-ink bg-paper px-3 py-2',
                      free && 'opacity-45',
                    )}
                  >
                    <span className="font-mono text-sm text-ink-soft">$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={price}
                      disabled={free}
                      onChange={(event) => setPrice(event.target.value)}
                      aria-label="Price in USDC"
                      className="w-20 bg-transparent font-mono tnum text-sm font-bold outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFree(!free)}
                    aria-pressed={free}
                    className={cn(
                      'label-micro cursor-pointer rounded-chip border-2 border-ink px-3 py-1.5 transition-transform duration-130 hover:-translate-y-px active:translate-y-px',
                      free ? 'bg-green text-paper' : 'bg-paper text-ink',
                    )}
                  >
                    Give it away free
                  </button>
                  <PriceChip usd={priceUsd} />
                </div>
              </Field>
            </section>
          ) : step === 2 ? (
            <section className="flex flex-col gap-5">
              <div>
                <h2 className="text-2xl">Who gets paid</h2>
                <p className="mt-2 max-w-[56ch] font-body text-ink-soft">
                  Every sale divides on settlement. Set it now, because after you
                  publish nobody can change it, including us.
                </p>
              </div>
              <SplitEditor members={members} onChange={setMembers} team={team} />
            </section>
          ) : (
            <Summary
              title={title}
              tagline={tagline}
              tags={tags}
              coverSeed={coverSeed}
              coverUrl={media.find((item) => item.id === coverId)?.url}
              mediaCount={media.length}
              priceUsd={priceUsd}
              members={members}
              build={build}
            />
          )}
        </div>

        {/* Publishing is two calls: the upload pins the build to IPFS and
            makes a draft, then publish locks the splits and mints the token.
            If the second fails the first still happened, and saying so is the
            difference between "try again" and "did anything happen at all". */}
        {publishError ? (
          <div className="mt-6 rounded-card border-2 border-ink border-l-8 border-l-red bg-paper-sunk px-5 py-4">
            <p className="font-body text-[15px] leading-relaxed">
              {publishError}
            </p>
            {draft ? (
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink-soft">
                Your build is uploaded and the game exists as a draft. Publishing
                again finishes it without uploading anything twice.
              </p>
            ) : null}
          </div>
        ) : null}

        {publishing ? (
          <p className="mt-6 font-mono text-[11px] leading-relaxed text-ink-soft">
            {draft
              ? 'Locking the splits and minting the token.'
              : 'Uploading the build and pinning it. Large builds take a while.'}
          </p>
        ) : null}

        {/* Nav */}
        <div className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t-2 border-ink pt-5">
          <Button
            variant="ghost"
            disabled={step === 0 || publishing}
            onClick={() => setStep((step - 1) as StepIndex)}
          >
            Back
          </Button>

          {step === 3 ? (
            <Button
              variant="go"
              size="lg"
              disabled={publishing}
              onClick={handlePublish}
            >
              {publishing
                ? draft
                  ? 'Publishing…'
                  : 'Uploading…'
                : draft
                  ? 'Finish publishing'
                  : 'Publish it'}
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={
                (step === 0 && !canLeaveBuild) ||
                (step === 1 && !canLeaveDetails) ||
                (step === 2 && !canLeaveSplits)
              }
              onClick={() => setStep((step + 1) as StepIndex)}
            >
              {step === 0 && !canLeaveBuild
                ? 'Add a build first'
                : step === 2 && !canLeaveSplits
                  ? 'Splits must total 100%'
                  : 'Next'}
            </Button>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

const inputClass =
  'w-full rounded-card border-2 border-ink bg-paper px-3.5 py-2.5 font-body text-base text-ink outline-none placeholder:text-ink-faint focus:shadow-hard-sm'

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
      <span className="label-micro block text-ink-soft">{label}</span>
      {hint ? (
        <span className="mt-0.5 block font-body text-[13px] text-ink-soft">
          {hint}
        </span>
      ) : null}
      <div className="mt-2">{children}</div>
    </div>
  )
}

function Stepper({
  step,
  reached,
  onGo,
}: {
  step: StepIndex
  reached: Record<number, boolean>
  onGo: (step: StepIndex) => void
}) {
  return (
    <ol className="mt-7 flex list-none flex-wrap gap-2 p-0">
      {STEPS.map((label, i) => {
        const available = i === 0 || reached[i]
        const done = i < step
        return (
          <li key={label}>
            <button
              type="button"
              disabled={!available}
              aria-current={i === step ? 'step' : undefined}
              onClick={() => onGo(i as StepIndex)}
              className={cn(
                'label-micro flex cursor-pointer items-center gap-1.5 rounded-chip border-2 border-ink px-3 py-1.5',
                'transition-transform duration-130 hover:-translate-y-px active:translate-y-px',
                'disabled:cursor-default disabled:opacity-40 disabled:hover:translate-y-0',
                i === step && 'bg-ink text-paper',
                i !== step && done && 'bg-green text-paper',
                i !== step && !done && 'bg-paper text-ink',
              )}
            >
              {done ? <Check size={12} strokeWidth={3.5} /> : `${i + 1}`}
              {label}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * The trust moment: the build runs before we ask for anything.
 * Night surface, because that's where games live (DESIGN.md §5).
 * TODO(integration): swap the CoverArt for the unpacked build in an iframe.
 */
function BuildPreview({
  build,
  mounted,
  title,
  coverSeed,
  loaded,
  onFrameLoad,
  onReplace,
}: {
  build: UploadedBuild
  mounted: MountedBuild | null
  title: string
  coverSeed: number
  loaded: boolean
  onFrameLoad: () => void
  onReplace: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Sticker tone="green">Running</Sticker>
          <h2 className="text-2xl">This is what buyers get.</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onReplace}>
          Replace build
        </Button>
      </div>

      <div className="overflow-hidden rounded-card border-[3px] border-ink bg-night shadow-hard-lg">
        <div className="flex items-center justify-between gap-3 border-b-2 border-paper/25 px-4 py-2">
          <span className="label-micro truncate text-paper/70">
            {build.name}
          </span>
          <span className="label-micro shrink-0 text-paper/70">
            {mounted ? `${mounted.fileCount} files · ` : ''}
            {(build.sizeKb / 1024).toFixed(1)} MB
          </span>
        </div>
        <div className="p-4 sm:p-6">
          <div className="mx-auto aspect-16/10 max-w-140 overflow-hidden rounded-card border-[3px] border-paper">
            {mounted ? (
              <BuildFrame
                src={mounted.entry}
                title={`${title} preview`}
                onLoad={onFrameLoad}
              />
            ) : (
              <CoverArt seed={coverSeed} className="h-full" />
            )}
          </div>
        </div>
      </div>

      {mounted ? <BuildDiagnostics build={mounted} loaded={loaded} /> : null}

      <p className="font-mono text-[11px] text-ink-soft">
        Running from your own machine. Nothing is uploaded until you publish.
      </p>
    </div>
  )
}

/** `deep-six.zip` becomes `Deep Six`, as a starting point they can overwrite. */
function guessTitle(filename: string): string {
  return filename
    .replace(/\.zip$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function Summary({
  title,
  tagline,
  tags,
  coverSeed,
  coverUrl,
  mediaCount,
  priceUsd,
  members,
  build,
}: {
  title: string
  tagline: string
  tags: string[]
  coverSeed: number
  coverUrl?: string
  mediaCount: number
  priceUsd: number
  members: DraftMember[]
  build: UploadedBuild | null
}) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-2xl">Last look</h2>

      <div className="flex flex-wrap gap-6">
        <div className="w-52 shrink-0 overflow-hidden rounded-card border-2 border-ink shadow-hard">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              className="block aspect-4/3 w-full object-cover"
            />
          ) : (
            <CoverArt seed={coverSeed} />
          )}
        </div>
        <div className="min-w-50 flex-1">
          <h3 className="text-2xl">{title}</h3>
          <p className="mt-1 font-body text-ink-soft">{tagline}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PriceChip usd={priceUsd} />
            {tags.map((tag) => (
              <span
                key={tag}
                className="label-micro rounded-chip border-2 border-ink bg-paper px-2.5 py-1 text-ink-soft"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="mt-3 font-mono text-[11px] text-ink-soft">
            {build?.name} · {((build?.sizeKb ?? 0) / 1024).toFixed(1)} MB
            {mediaCount > 0 ? ` · ${mediaCount} media` : ''}
          </p>
        </div>
      </div>

      <div className="rounded-card border-2 border-ink bg-paper-sunk p-5">
        <span className="label-micro text-ink-soft">Splits, about to lock</span>
        <ul className="mt-3 flex list-none flex-col gap-1.5 p-0 font-mono text-[13px]">
          {members.map((member) => (
            <li key={member.id} className="flex justify-between gap-4">
              <span className="truncate">
                {member.label}
                <span className="text-ink-soft"> · {member.role}</span>
              </span>
              <span className="tnum shrink-0 font-bold">{member.pct}%</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t-2 border-ink pt-3 font-body text-[13px] leading-relaxed text-ink">
          Publishing locks these. There is no edit screen afterwards, not for
          you and not for us.
        </p>
      </div>
    </section>
  )
}

function Published({
  game,
  studioId,
  invites,
  onGo,
}: {
  game: { title: string; splitCount: number }
  studioId: string
  invites: Array<{ id: string; email: string }>
  onGo: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-215 flex-1 flex-col items-start gap-6 px-6 py-16">
        <Sticker tone="green" className="-rotate-2">
          Live now
        </Sticker>
        <h1 className="text-[clamp(32px,5vw,52px)]">{game.title} is up.</h1>
        <p className="max-w-[52ch] font-body text-[17px] leading-relaxed text-ink-soft">
          {game.splitCount > 1
            ? 'It’s in the catalog and anyone can play it. Everyone on the splits gets their share from the first sale, including anyone who hasn’t accepted their invite yet.'
            : 'It’s in the catalog and anyone can play it. Every sale lands in your wallet on settlement.'}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" size="lg" onClick={onGo}>
            View the listing
          </Button>
          <ButtonLink to={`/studio/${studioId}`} variant="neutral" size="lg">
            Your studio
          </ButtonLink>
        </div>
        {invites.length > 0 ? (
          <div className="w-full max-w-140 rounded-card border-2 border-dashed border-ink-faint p-4">
            <p className="label-micro text-ink-soft">
              Invites sent · demo controls, not shipping
            </p>
            <p className="mt-2 font-body text-[13px] leading-relaxed text-ink-soft">
              These go out by email. There is no mail server here, so open one
              to see what they receive.
            </p>
            {/* TODO(demo): delete. Real invites arrive in the invitee's inbox. */}
            <ul className="mt-3 flex list-none flex-col gap-1.5 p-0">
              {invites.map((invite) => (
                <li key={invite.id}>
                  <Link
                    to={`/invite/${invite.id}`}
                    className="font-mono text-[12px] text-ink underline underline-offset-2"
                  >
                    {invite.email}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Link
          to="/publish"
          reloadDocument
          className="font-mono text-[11px] text-ink-soft underline underline-offset-2"
        >
          Publish another
        </Link>
      </main>
      <SiteFooter />
    </div>
  )
}
