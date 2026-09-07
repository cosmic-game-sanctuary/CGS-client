import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { shipBuild, type WireBuildVersion } from '@/api/manage'
import { errorMessage } from '@/lib/api'
import { formatDate } from '@/lib/format'
import type { WireGame } from '@/api/wire'

/**
 * A new version of a game people already bought.
 *
 * This is the argument for a key rather than a download, made real: everyone
 * who owns the game gets the patch, without paying again and without doing
 * anything. Every previous version's CID stays in the history permanently, so
 * "what did I actually buy" has an answer that outlives us.
 */
export function ShipBuild({
  game,
  builds,
  onShipped,
}: {
  game: WireGame
  builds: WireBuildVersion[]
  onShipped: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [label, setLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function ship() {
    if (!file) return
    setBusy(true)
    setProblem(null)
    try {
      await shipBuild(game.id, file, {
        label: label.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      setFile(null)
      setLabel('')
      setNotes('')
      onShipped()
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-2xl">Builds</h2>
        <span className="font-mono text-[11px] text-ink-soft">
          everyone who owns it gets the newest one
        </span>
      </div>

      <div className="mt-5 rounded-card border-2 border-ink bg-paper-sunk p-5">
        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="neutral" size="sm" onClick={() => fileRef.current?.click()}>
            {file ? 'Pick another zip' : 'Choose a zip'}
          </Button>
          <span className="min-w-0 truncate font-mono text-[13px] text-ink-soft">
            {file
              ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`
              : 'No file chosen'}
          </span>
        </div>

        {file ? (
          <div className="mt-4 flex flex-col gap-3">
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Your name for it, like 1.0.2"
              maxLength={40}
              className={input}
            />
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="What changed?"
              className={`${input} resize-y leading-relaxed`}
            />
            <div>
              <Button variant="primary" disabled={busy} onClick={() => void ship()}>
                {busy ? 'Uploading…' : 'Ship this build'}
              </Button>
            </div>
          </div>
        ) : null}

        {problem ? (
          <p role="alert" className="mt-3 font-body text-sm text-red">
            {problem}
          </p>
        ) : null}
      </div>

      {builds.length > 0 ? (
        <ul className="mt-4 flex list-none flex-col gap-2 p-0">
          {builds.map((build) => (
            <li
              key={build.version}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-card border-2 border-ink bg-paper px-4 py-2.5"
            >
              <span className="tnum font-mono text-[13px] font-bold">
                v{build.version}
              </span>
              {build.label ? (
                <span className="font-mono text-[13px]">{build.label}</span>
              ) : null}
              {build.notes ? (
                <span className="min-w-0 flex-1 truncate font-body text-[14px] text-ink-soft">
                  {build.notes}
                </span>
              ) : (
                <span className="flex-1" />
              )}
              {/* The CID is the whole provenance claim. Truncated, but present:
                  a player can check that what they run is what was pinned. */}
              <span
                className="font-mono text-[11px] text-ink-faint"
                title={build.buildCid}
              >
                {build.buildCid.slice(0, 10)}…
              </span>
              <span className="font-mono text-[11px] text-ink-soft">
                {formatDate(build.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

const input =
  'w-full rounded-card border-2 border-ink bg-paper px-3.5 py-2.5 font-body text-[15px] outline-none placeholder:text-ink-faint focus:shadow-hard-sm'
