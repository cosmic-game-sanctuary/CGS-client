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
 * The cost is real: because the build is served from our own origin, an
 * `allow-same-origin` frame can reach the parent page. That is acceptable for
 * previewing a build you just chose yourself, and NOT acceptable for running
 * strangers' games in production.
 *
 * TODO(security): before this is public, serve /__preview/ from a separate
 * origin (a subdomain, the way itch.io uses html-classic.itch.zone) so the
 * frame can keep same-origin storage without being same-origin with the app.
 */
export function BuildFrame({
  src,
  title,
  onLoad,
  className,
}: {
  /** A /__preview/… URL from mountBuild(). */
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
