import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import {
  checkHandle,
  removeAvatar,
  updateProfile,
  uploadAvatar,
  type WireUserProfile,
} from '@/api/profiles'
import { errorMessage } from '@/lib/api'
import { refreshSession } from '@/auth/session'
import { useDebounced } from '@/lib/useDebounced'

/**
 * Editing your own page.
 *
 * The handle gets normalised on the way in — "Kai Saha" becomes `kaisaha` —
 * so the normalised value is shown back before anything is saved. Finding out
 * what your own name became after pressing save is a small betrayal, and it is
 * the kind that makes people distrust the next field too.
 */
export function ProfileEditor({
  profile,
  onSaved,
}: {
  profile: WireUserProfile
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="neutral" size="sm" onClick={() => setOpen(true)}>
        Edit profile
      </Button>
      {open ? (
        <EditorDialog
          profile={profile}
          onClose={() => setOpen(false)}
          onSaved={() => {
            onSaved()
            // The header shows your name and avatar too.
            refreshSession()
          }}
        />
      ) : null}
    </>
  )
}

function EditorDialog({
  profile,
  onClose,
  onSaved,
}: {
  profile: WireUserProfile
  onClose: () => void
  onSaved: () => void
}) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? '')
  const [handle, setHandle] = useState(profile.handle ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [libraryPublic, setLibraryPublic] = useState(profile.libraryPublic)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const typed = useDebounced(handle.trim(), 350)
  const [check, setCheck] = useState<{
    for: string
    normalised: string | null
    available: boolean
    reason: string | null
  } | null>(null)

  // Only ever asks about a handle that differs from the one they already have,
  // so nobody is told their own name is taken.
  const changed = typed.length > 0 && typed !== (profile.handle ?? '')

  useEffect(() => {
    if (!changed) return
    const controller = new AbortController()
    checkHandle(typed, controller.signal)
      .then((result) =>
        setCheck({
          for: typed,
          normalised: result.normalised,
          available: result.available,
          reason: result.reason,
        }),
      )
      .catch(() => {
        // A check that will not run should not block a save. The server
        // decides for real on submit and answers HANDLE_TAKEN if it has to.
        if (!controller.signal.aborted) {
          setCheck({ for: typed, normalised: null, available: true, reason: null })
        }
      })
    return () => controller.abort()
  }, [typed, changed])

  const current = check?.for === typed ? check : null

  async function pickAvatar(file: File) {
    setProblem(null)
    try {
      const { avatarUrl: next } = await uploadAvatar(file)
      setAvatarUrl(next)
    } catch (error) {
      setProblem(errorMessage(error))
    }
  }

  async function save() {
    setSaving(true)
    setProblem(null)
    try {
      await updateProfile({
        displayName: displayName.trim() || null,
        // Unchanged handles are left out entirely rather than sent back, so a
        // save never has to survive its own uniqueness check.
        ...(changed ? { handle: typed } : {}),
        bio: bio.trim() || null,
        libraryPublic,
      })
      onSaved()
      onClose()
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal eyebrow="Your profile" title="Edit profile" onClose={onClose}>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={avatarUrl} name={displayName || handle} size={64} />
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void pickAvatar(file)
            }}
          />
          <Button size="sm" variant="neutral" onClick={() => fileRef.current?.click()}>
            {avatarUrl ? 'Change picture' : 'Add a picture'}
          </Button>
          {avatarUrl ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void removeAvatar()
                  .then(() => setAvatarUrl(null))
                  .catch((error: unknown) => setProblem(errorMessage(error)))
              }
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <Field label="Display name" hint="What people see. Optional.">
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={60}
          placeholder="Kai"
          className="w-full rounded-card border-2 border-ink bg-paper px-3.5 py-2.5 font-body text-[15px] outline-none placeholder:text-ink-faint focus:shadow-hard-sm"
        />
      </Field>

      <Field label="Handle" hint="The address of this page.">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] text-ink-soft">/u/</span>
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            maxLength={30}
            placeholder="kai"
            className="w-full rounded-card border-2 border-ink bg-paper px-3.5 py-2.5 font-mono text-[15px] outline-none placeholder:text-ink-faint focus:shadow-hard-sm"
          />
        </div>
        {current ? (
          <p className="mt-1.5 font-mono text-[11px] text-ink-soft">
            {current.normalised && current.normalised !== typed
              ? `Saved as ${current.normalised}. `
              : ''}
            {current.available
              ? 'Available.'
              : current.reason === 'taken'
                ? 'Someone has that one.'
                : current.reason === 'reserved'
                  ? 'That one is reserved.'
                  : 'That will not work as a handle.'}
          </p>
        ) : null}
      </Field>

      <Field label="Bio" hint="Optional.">
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          rows={3}
          maxLength={400}
          className="w-full resize-y rounded-card border-2 border-ink bg-paper px-3.5 py-2.5 font-body text-[15px] leading-relaxed outline-none focus:shadow-hard-sm"
        />
      </Field>

      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={libraryPublic}
          onChange={(event) => setLibraryPublic(event.target.checked)}
          className="mt-1 h-4 w-4 accent-green"
        />
        <span>
          <span className="block font-body text-[15px]">
            Show what I own
          </span>
          <span className="block font-mono text-[11px] text-ink-soft">
            Your reviews and credits stay public either way.
          </span>
        </span>
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          disabled={saving || (changed && current !== null && !current.available)}
          onClick={() => void save()}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>

      {problem ? (
        <p role="alert" className="mt-3 font-body text-sm text-red">
          {problem}
        </p>
      ) : null}
    </Modal>
  )
}

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
    <div className="mt-4">
      <span className="label-micro block text-ink-soft">
        {label}
        {hint ? <span className="ml-2 normal-case">{hint}</span> : null}
      </span>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}
