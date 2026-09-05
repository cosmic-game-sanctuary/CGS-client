/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Origin that serves uploaded game builds. Must differ from the app's own
   * origin, so a stranger's build can't reach the app. See
   * `src/lib/previewHost.ts`; in dev this is derived and needs no value.
   */
  readonly VITE_PREVIEW_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
