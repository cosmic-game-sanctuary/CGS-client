import { cn } from '@/lib/utils'

/**
 * Runs a mounted build.
 *
 * ── On the sandbox ────────────────────────────────────────────────────────
 * `allow-same-origin` is here on purpose. Without it the iframe gets an opaque
 * origin, and every engine that touches localStorage or IndexedDB throws on
 * boot: Godot, Unity, Construct and most of Phaser's templates all do. The
 * symptom is a black rectangle and no obvious error, which is exactly the bug
 * it caused here.
 *
 * It is safe because `src` is on the **build origin**, not ours (see
 * `src/lib/previewHost.ts`). Same-origin there means the build is same-origin
 * with itself; it still cannot read a thing on this page. `allow-top-navigation`
 * is deliberately absent, so a game can't move the tab out from under the
 * player either.
 *
 * If the build origin is unreachable the mount falls back to this origin and
 * warns in the console. That fallback is for a local dev machine only. Setting
 * VITE_PREVIEW_ORIGIN is a launch requirement, not a nice-to-have.
 */
export function BuildFrame({
  src,
  title,
  onLoad,
  className,
}: {
  /** An absolute /__preview/… URL from mountBuild(). */
  src: string
  title: string
  onLoad?: () => void
  className?: string
}) {
  return (
    <iframe
      key={src}
      src={src}
      title={title}
      onLoad={onLoad}
      sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-downloads allow-popups allow-forms allow-modals"
      allow="autoplay; gamepad; fullscreen; xr-spatial-tracking; cross-origin-isolated"
      className={cn('block h-full w-full border-0 bg-night', className)}
    />
  )
}
