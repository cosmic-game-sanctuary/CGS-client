# CGS-client

The storefront, the player and the upload flow for
**[Cosmic Game Sanctuary](https://github.com/cosmic-game-sanctuary/CGS-docs)** —
an indie game store where an agent can buy on your behalf, revenue splits pay a
whole team atomically, and trials are metered by the minute.

📺 **[Four-minute demo](https://youtu.be/WyJehf7Vgb4)** · 📖 [How it all works](https://github.com/cosmic-game-sanctuary/CGS-docs/blob/main/ARCHITECTURE.md) · 🔌 [API contract](https://github.com/cosmic-game-sanctuary/CGS-docs/blob/main/INTEGRATION.md)

Built for ETHOnline 2026. React 19 + Vite + Tailwind v4.

---

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev
```

Two values in `.env.local` matter: `VITE_API_URL` (defaults to
`http://localhost:3000`) and `VITE_PRIVY_APP_ID`, which **must be the same
Privy app the server verifies tokens against** or every authenticated request
401s. Missing it shows a setup screen rather than failing obscurely.

Needs [CGS-server](https://github.com/cosmic-game-sanctuary/CGS-server) running
for anything past browsing.

| | |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | typecheck + production build |
| `npm run lint` | eslint |
| `npm run icons` | re-extract Freehand icons after editing `WANTED` |

## Two things worth knowing before reading the code

**Uploaded games run on a second origin.** A dropped zip is unpacked in the
browser with `fflate`, written into the Cache API on a *different* origin, and
served back by a service worker there. The game frame needs `allow-same-origin`
or every engine that touches `localStorage` dies on boot — and giving that to a
stranger's build on our own origin would let it read the session. Its own
origin is same-origin with itself and cross-origin with us, which is the
property we actually wanted. Same shape as itch.io's `html-classic.itch.zone`.

In dev this needs no configuration: `localhost`, `127.0.0.1` and `[::1]` are
three origins on one machine, and the app probes for whichever the dev server
answers on. In production set `VITE_PREVIEW_ORIGIN` to a subdomain serving the
same `dist/`.

**The buyer signs their own purchases.** The server builds and freezes the
Hedera transfer; this app signs the hashes with Privy's `secp256k1_sign` and
hands them back. The server never holds a buyer's key, and nobody is asked to
delegate their wallet to a shop. See `src/auth/useWalletSigner.ts`.

## Layout

```
src/api/        one module per area over lib/api.ts.
                wire.ts = what the server sends, mocks/types.ts = what
                components are written against, adapt.ts knows both
src/auth/       session, Privy provider, the wallet signer
src/components/ checkout/ play/ publish/ listing/ manage/ studio/ agent/ ui/
src/routes/     one per screen
src/lib/        formatting, countdowns, and the zip-to-running-game pipeline
src/styles/     tokens.css is the whole design system
public/         preview-host.html + preview-sw.js run on the build origin
```

## Design

[DESIGN.md](DESIGN.md) is the spec, not a suggestion. The short version is
**Paper Arcade**: ink on warm paper, hard offset shadows, hand-drawn icons, and
colour rationed to money, ownership, the agent and warnings.

Two rules that get broken most often: no em dashes in any user-visible string,
and the chrome never competes with cover art.
