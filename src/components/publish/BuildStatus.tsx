import { AlertTriangle, Check, ExternalLink, Loader } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  onPreviewMiss,
  STAGE_LABEL,
  type MountedBuild,
  type MountStage,
  type PreviewMiss,
} from '@/lib/buildPreview'
import { cn } from '@/lib/utils'

const STAGES: MountStage[] = [
  'worker',
  'reading',
  'unzipping',
  'writing',
  'starting',
]

/** How long a build gets to draw something before we say it looks stuck. */
const STUCK_MS = 12000

export function UnpackProgress({ stage }: { stage: MountStage | null }) {
  const reached = stage ? STAGES.indexOf(stage) : -1

  return (
    <div className="w-full max-w-[420px]">
      <ul className="flex list-none flex-col gap-1.5 p-0">
        {STAGES.map((step, i) => {
          const done = reached > i
          const active = reached === i
          return (
            <li
              key={step}
              className={cn(
                'flex items-center gap-2.5 font-mono text-[12px]',
                done && 'text-ink-soft',
                active && 'font-bold text-ink',
                !done && !active && 'text-ink-faint',
              )}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {done ? (
                  <Check size={13} strokeWidth={3.5} className="text-green" />
                ) : active ? (
                  <Loader size={13} strokeWidth={3} className="animate-spin" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" />
                )}
              </span>
              {STAGE_LABEL[step]}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * What happened after the build started. A game that boots to a black screen
 * is otherwise undebuggable, so this reports the files it asked for and
 * couldn't find, which is nearly always the actual problem.
 */
export function BuildDiagnostics({
  build,
  loaded,
}: {
  build: MountedBuild
  loaded: boolean
}) {
  const [misses, setMisses] = useState<PreviewMiss[]>([])
  const [stuck, setStuck] = useState(false)
  const [showFiles, setShowFiles] = useState(false)

  useEffect(() => onPreviewMiss((miss) => {
    setMisses((all) =>
      all.some((existing) => existing.path === miss.path) ? all : [...all, miss],
    )
  }), [])

  useEffect(() => {
    const timer = window.setTimeout(() => setStuck(true), STUCK_MS)
    return () => window.clearTimeout(timer)
  }, [build.id])

  const failed = misses.filter((miss) => !miss.rescued)
  const rescued = misses.filter((miss) => miss.rescued)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] text-ink-soft">
        <span className="flex items-center gap-1.5">
          {loaded ? (
            <>
              <Check size={12} strokeWidth={3.5} className="text-green" />
              Loaded
            </>
          ) : (
            <>
              <Loader size={12} strokeWidth={3} className="animate-spin" />
              Starting
            </>
          )}
        </span>
        <span>
          entry <b className="text-ink">{build.entryPath}</b>
        </span>
        <button
          type="button"
          onClick={() => setShowFiles(!showFiles)}
          className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[11px] text-ink-soft underline underline-offset-2"
        >
          {build.fileCount} files
        </button>
        <a
          href={build.entry}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-ink"
        >
          Open in a tab
          <ExternalLink size={11} strokeWidth={2.5} />
        </a>
      </div>

      {showFiles ? (
        <ul className="max-h-40 list-none overflow-y-auto rounded-card border-2 border-ink bg-paper-sunk p-3 font-mono text-[11px] leading-relaxed">
          {build.paths.map((path) => (
            <li key={path} className="truncate text-ink-soft">
              {path}
            </li>
          ))}
        </ul>
      ) : null}

      {failed.length > 0 ? (
        <div className="rounded-card border-2 border-ink bg-pink p-4 text-paper">
          <p className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-wider uppercase">
            <AlertTriangle size={13} strokeWidth={3} />
            {failed.length} file{failed.length === 1 ? '' : 's'} missing
          </p>
          <ul className="mt-2 max-h-28 list-none overflow-y-auto p-0 font-mono text-[11px] leading-relaxed">
            {failed.map((miss) => (
              <li key={miss.path} className="truncate">
                {miss.path}
              </li>
            ))}
          </ul>
          <p className="mt-2.5 font-body text-[13px] leading-relaxed">
            The build asked for these and they are not in the zip. Usually the
            zip is missing a folder, or was made from the wrong directory.
          </p>
        </div>
      ) : null}

      {rescued.length > 0 && failed.length === 0 ? (
        <p className="font-mono text-[11px] text-ink-soft">
          {rescued.length} absolute path{rescued.length === 1 ? '' : 's'}{' '}
          redirected into the build. Fine here; worth fixing before release.
        </p>
      ) : null}

      {stuck && !loaded && failed.length === 0 ? (
        <div className="rounded-card border-2 border-ink bg-yellow p-4">
          <p className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-wider uppercase">
            <AlertTriangle size={13} strokeWidth={3} />
            Still nothing after {STUCK_MS / 1000}s
          </p>
          <p className="mt-2 max-w-[60ch] font-body text-[13px] leading-relaxed">
            The files are all there, so the game itself is failing to start.
            Open it in a tab and check the browser console. The usual causes are
            a build that needs cross-origin isolation for threads, or one that
            expects to be served from a folder other than its root.
          </p>
        </div>
      ) : null}
    </div>
  )
}
