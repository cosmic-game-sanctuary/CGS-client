# CLAUDE.md — CGS-client

Working rules for this repo. Read before writing any code.

**This is the frontend repo only.** CGS is a **multi-repo** project, not a monorepo:

| Repo | What | Our access |
|---|---|---|
| `CGS-client` | ← you are here. Vite + React web app. | read / write |
| `CGS-server` | Node + Express + Drizzle + Hedera. Kai's. | **read only** |
| `CGS-docs` | Product, technical and shared progress docs. | **read only** |

Never write to the sibling repos. Read from them freely — `../CGS-docs/cgs-ideation.md` is the product story and `../CGS-docs/cgs-technical.md` is the backend detail.

> **Note:** `../CGS-docs/CLAUDE.md` exists and governs the *backend/chain* side. It is not this file. Where they overlap (the hard product rules), they agree.

---

## 1. Product context

**Cosmic Game Sanctuary** — a storefront for browser-playable indie games where payment and ownership settle on Hedera. Devs upload HTML5/WASM builds, buyers pay in crypto, and a **GameKey** token lands in the buyer's wallet as real proof of ownership. ETHOnline 2026, Start Fresh track, team of two.

**The origin:** in 2025 Visa and Mastercard pressured itch.io and Steam into mass delistings overnight. CGS removes the payment processor from the equation, so no card network gets a veto on what's sellable.

**But that's the motivation, not the headline.** The actual claim is: *the first consumer storefront where an autonomous agent is a first-class buyer.*

### Two things that shape every UI decision

1. **This must not look or feel like a crypto app.** No wallet-connect-first landing, no seed phrases, no "approve transaction" jargon. Reference points: Poki, CrazyGames, itch.io. A games portal that happens to settle on-chain.
2. **The wow moment is instant play.** Buyer pays → game boots *in the same tab*, seconds later. No install, no launcher. This gets real polish budget — see [DESIGN.md §5](DESIGN.md).

### Not

Not a web3 game. Not GameFi. Not an adult-content site. Say it early — ~90% of GameFi projects are dead, and anyone who pattern-matches CGS to that stops listening in ten seconds.

### Screens we own

| Screen | Notes |
|---|---|
| Catalog / browse | Grid of games. **Must work with no wallet and no login.** |
| Game listing | Cover art, screenshots, description, price, reviews, buy. |
| Checkout | Sign in → fund if needed → pay → key mints → play. The critical path. |
| In-browser player | Loads the build. The payoff. |
| Dev upload | Drag a zip → **see it playing in the page before publishing** → price → teammates by email → splits totalling 100% → publish. |
| Studio profile | Games, ENS name if claimed. |
| Agent setup | Pick a game, set a trigger price, fund the agent's wallet. Show balance and status. |
| Swipe discovery | "Surprise me". Genuinely differentiating, pure frontend. **Keep in mind, not building first.** |

**Priority if time runs short:** checkout→instant play, then drag-zip→preview, then a catalog that doesn't look empty, then the agent screen. Cut breadth, keep those four sharp.

### Hard product rules — these are design failures if violated

- **No resale.** No secondary market, no "sell this key", no price floor, no royalty — anywhere in the UI.
- **No refunds.** All sales final, stated plainly rather than hidden.
- **Splits are immutable after publish.** No edit UI, no admin override. That's the product promise, not a missing feature.
- **No biometric / identity verification** in the upload flow. Cut on purpose.
- **No adult content.** Out of scope for MVP, which also removes any age-gate obligation.
- **Browsing never requires auth.** Wallet and login appear only at buy and publish.
- Also cut: achievements, user profiles, pay-what-you-want pricing, native/desktop builds.

If a request conflicts with any of these, stop and ask rather than guessing.

---

## 2. Design

**[DESIGN.md](DESIGN.md) is the spec, not a suggestion.** Read it before writing UI. Live interactive reference: https://claude.ai/code/artifact/5f698fba-a85c-48c6-8430-0fab5d647bcd

The one-line version — **Paper Arcade**: ink on warm paper, hard offset shadows, hand-drawn icons, and colour rationed to money, ownership, the agent and warnings. The chrome never competes with cover art.

Locked as of 5 Sep 2026: name, palette, type (**Fraunces / Public Sans / Martian Mono**), physics, the seven named motions, tone B for the app and C for the landing page, and the banlist. Don't re-open these without a real reason.

The banlist in [DESIGN.md §9](DESIGN.md) is the part most likely to be violated by generated code. Check against it before saying a screen is done.

---

## 3. Technical context

### Stack

| Layer | Choice |
|---|---|
| Build | Vite 8 |
| UI | React 19 + TypeScript 6 |
| Styling | **Tailwind v4** — tokens via `@theme` in `src/styles/tokens.css` ([DESIGN.md §12](DESIGN.md)) |
| Components | shadcn/ui via [neobrutalism.dev](https://www.neobrutalism.dev) as a starting skeleton, **tokens overwritten with ours immediately** |
| Icons | `@iconify-json/streamline-freehand` (CC BY 4.0) for character, `lucide-react` (MIT) for chrome |
| Auth / wallets | `@privy-io/react-auth` — **later, not now** |
| Routing / data | not chosen yet — decide when the second screen lands, not before |

### tsconfig gotchas (already set, will bite generated code)

- `verbatimModuleSyntax: true` → type-only imports **must** use `import type { Foo } from '...'`.
- `erasableSyntaxOnly: true` → **no `enum`, no constructor parameter properties.** Use `as const` objects and union types.
- `noUnusedLocals` / `noUnusedParameters` → unused anything fails the build. Prefix intentionally-unused params with `_`.
- **No `@/*` path alias exists yet.** shadcn expects one — add it to `tsconfig.app.json` `compilerOptions.paths` *and* `vite.config.ts` `resolve.alias` together, or imports resolve in the editor and fail at build.

### Backend contract

Kai's building this. Shapes may shift early — confirm before hardcoding.

```
GET  /api/games                    # catalog; filters, pagination
GET  /api/games/:id                # detail + studio + split info
POST /api/studios                  # create studio (+ optional ENS name)
POST /api/studios/:id/members      # invite teammate by EMAIL, not wallet address
POST /api/games                    # publish — multipart: build + art + metadata
GET  /api/games/:id/download       # ← x402-gated, the non-standard one
GET  /api/games/:id/owned          # does this wallet hold a GameKey?
POST /api/games/:id/reviews        # only works if the wallet owns the game
GET  /api/games/:id/reviews
POST /api/agents                   # create agent → returns a wallet address to fund
GET  /api/agents/:id               # balance, trigger, status
POST /api/reports                  # moderation
```

Every endpoint is ordinary REST **except** `GET /api/games/:id/download`, which uses **x402**: it returns HTTP `402` with payment requirements instead of the file; you sign a payment and retry the request. **Kai hands us a helper for this — don't build it from scratch, ask for a walkthrough when we get there.**

Backend stack, for context when generating client types: Node + TypeScript, Express, Postgres via Drizzle, `@hashgraph/sdk` for payments and GameKey NFTs, Privy server SDK for the agent wallet, ENSv2 on Sepolia, IPFS via Pinata served from `ipfs.io`.

### The current phase — read this before proposing anything

**We are building the entire UI on mock data first.** No backend connection, no Privy, no wallet, no chain, no x402. Every screen renders from local fixtures.

- Mock data lives in `src/mocks/`, typed against the contract above.
- Async is faked with a small delay so loading states are real and get designed.
- **Do not add `@privy-io/react-auth`, `wagmi`, `viem`, or any fetch to `/api` yet.** Integration is a later, deliberate phase.
- Auth state is a mock toggle, so signed-in and signed-out layouts can both be built and reviewed.

---

## 4. Progress — this repo only

> Shared cross-team status lives in `../CGS-docs/PROGRESS-LOG.md`. This section is the frontend's own.
> Append; don't rewrite history. Keep the status block current.

### Current status

**Stage:** Design language → scaffolding
**Deps installed:** React + Vite only. Tailwind not yet installed.
**Screens built:** none
**Deployed:** no

**Working end to end:** nothing yet — the repo is still the stock Vite template (`src/App.tsx` is the counter demo).

**Next up:**
1. Strip the Vite template (`App.tsx`, `App.css`, `src/assets/`, `public/icons.svg`, `public/favicon.svg`).
2. Install Tailwind v4, add `src/styles/tokens.css` from [DESIGN.md §12](DESIGN.md), wire the Google Fonts link into `index.html`.
3. Add the `@/*` alias in both `tsconfig.app.json` and `vite.config.ts`.
4. Install icons: `@iconify-json/streamline-freehand`, `@iconify/react`, `lucide-react`.
5. Build **catalog + game listing** on mock data — they exercise the game card, price chip, grid stagger and hover handling, so any flaw in the design language surfaces on day one instead of day six.
6. Then checkout → play (the lights-down sequence), upload + splits, agent screen.
7. Install Impeccable **after** those first screens exist, and run `/impeccable audit` per screen.

### Blockers

| Who | Blocked on | Since | Needs |
|---|---|---|---|
| — | — | — | — |

### Decisions

| Decision | Choice | Why |
|---|---|---|
| Design language | **Paper Arcade** — ink on paper, riso accents, hand-drawn icons | Reads as indie/zine, not crypto. Chrome stays monochrome so cover art can be loud. See [DESIGN.md](DESIGN.md). |
| Tone | B (soft brutal) for the app, C (sticker arcade) for the landing page | Radius 10 + no content rotation keeps browsing friendly; the landing page has no cover art to fight, so the volume goes up. |
| Typefaces | Fraunces (WONK 1, SOFT 100) / Public Sans / Martian Mono | A wonky serif reads zine-made rather than tech; mono marks every ledger value as a fact. |
| Styling stack | Tailwind v4 + shadcn (neobrutalism.dev skeleton), tokens overwritten | Component velocity is the whole game while building the UI on mock data. |
| Icon strategy | Freehand large (character) + Lucide small (chrome) | The free Freehand set has no plain X, plus, chevron, check or trash — it's an illustration set, not a UI set. |
| Build order | Whole UI on mock data before any integration | Lets the design language be validated and the screens polished without waiting on backend or Privy. |
| Swipe discovery | In scope, not first | Pure frontend surface and a real differentiator, but it's not on the critical demo path. |

### Log

_Newest first._

#### 2026-09-05 — Suparno
- **Did:** Read the product docs. Landed and locked the design language (Paper Arcade) — palette, type, physics, seven-move motion system, icon strategy, tone B/C split, banlist. Wrote `DESIGN.md` and this file.
- **Works now:** Nothing runnable beyond the stock Vite template. The design language exists as a live interactive reference artifact plus `DESIGN.md`.
- **Next:** Strip the template, install Tailwind v4 + tokens + fonts + icons, then catalog and game listing on mock data.
- **Notes for the other side:** None yet. Will need the x402 helper walkthrough before checkout integration, and confirmation of the `/api/games` response shape before mock fixtures get locked to it.

---

## 5. Session protocol

**At session start:** read §4 — current status, blockers, and the most recent log entry. Read [DESIGN.md](DESIGN.md) before touching UI.

**At session end:** append a log entry (what changed, what works now, what's next, anything Kai needs to know), update the status block, add or clear blockers, and record any new decision in the decisions table. Append; never rewrite history.

**Never commit `.env` or a private key.** Check `.gitignore` covers it before the first commit in any new package.
