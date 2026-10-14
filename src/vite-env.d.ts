/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Origin that serves uploaded game builds. Must differ from the app's own
   * origin, so a stranger's build can't reach the app. See
   * `src/lib/previewHost.ts`; in dev this is derived and needs no value.
   */
  readonly VITE_PREVIEW_ORIGIN?: string
  /**
   * `testnet` (the default) or `mainnet`. Must match the server's
   * `ARC_NETWORK`. See `src/lib/network.ts`.
   */
  readonly VITE_ARC_NETWORK?: string
  /** Replaces the public Arc RPC for the wallet. Ships in the bundle. */
  readonly VITE_ARC_RPC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
