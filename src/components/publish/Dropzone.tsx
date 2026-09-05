import { useRef, useState } from 'react'
import { Freehand } from '@/components/icons/Freehand'
import { UnpackProgress } from '@/components/publish/BuildStatus'
import type { MountStage } from '@/lib/buildPreview'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export interface UploadedBuild {
  name: string
  sizeKb: number
}

/**
 * Drag a zip in. It is unpacked in the browser and actually run, right here.
 * Nothing is uploaded.
 * TODO(integration): multipart POST to /api/games with build + art + metadata.
 */
export function Dropzone({
  onBuild,
  busy,
  stage,
  error,
}: {
  onBuild: (file: File) => void
  busy: boolean
  stage?: MountStage | null
  error?: string | null
}) {
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function take(file: File | undefined) {
    if (!file) return
    onBuild(file)
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        take(event.dataTransfer.files[0])
      }}
      className={cn(
        'flex flex-col items-center gap-4 rounded-card border-[3px] border-dashed px-6 py-12 text-center transition-colors duration-150',
        over ? 'border-ink bg-yellow' : 'border-ink-faint bg-paper-sunk',
      )}
    >
      <Freehand
        name="upload-brackets"
        className={cn('h-20 w-20', over ? 'text-ink' : 'text-ink-soft')}
      />

      <div>
        <h2 className="text-2xl">Drop your build here</h2>
        <p className="mt-2 max-w-[44ch] font-body text-sm leading-relaxed text-ink-soft">
          A zip with an <code>index.html</code> at the root. HTML5 or WASM,
          anything that runs in a browser.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(event) => take(event.target.files?.[0])}
      />

      <Button
        variant="neutral"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Unpacking…' : 'Choose a file'}
      </Button>

      {busy ? <UnpackProgress stage={stage ?? null} /> : null}

      {error ? (
        <p className="max-w-[46ch] rounded-card border-2 border-ink bg-pink px-4 py-2.5 font-mono text-[11px] leading-relaxed text-paper">
          {error}
        </p>
      ) : null}
    </div>
  )
}
