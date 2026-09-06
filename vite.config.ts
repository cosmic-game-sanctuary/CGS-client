import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const stub = fileURLToPath(new URL('./src/lib/unusedChainStub.cjs', import.meta.url))

/**
 * Privy declares Solana, Abstract and Farcaster packages as optional peer
 * dependencies and imports them from its main entry anyway. We don't install
 * them: CGS settles on Hedera and the wallet is EVM only. Vite stubs an
 * uninstalled optional peer with an empty module, and the build then fails on
 * every named import from it.
 *
 * Pointing them at a stub that can answer any name keeps the bundle free of
 * Solana tooling and keeps the failure honest — the stub throws if anything
 * ever actually reaches it. See src/lib/unusedChainStub.cjs.
 */
const UNUSED_CHAIN_PEERS = [
  '@solana/kit',
  '@solana-program/system',
  '@solana-program/token',
  '@solana-program/memo',
  '@abstract-foundation/agw-client',
  '@farcaster/mini-app-solana',
  'permissionless',
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      ...Object.fromEntries(UNUSED_CHAIN_PEERS.map((name) => [name, stub])),
    },
  },
})
