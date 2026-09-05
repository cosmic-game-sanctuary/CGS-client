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

| Screen | Status | Notes |
|---|---|---|
| Catalog / browse | ✅ done | Grid, filters, sort, search, empty + loading states. Works with no wallet and no login. |
| Game listing | ✅ done | Cover, description, price, public splits, verified-purchase reviews, report. |
| Checkout | ✅ done | Overlay, not a route. Sign in → fund → pay → mint → boot. All mocked. |
| In-browser player | ✅ done | `GameStage` on the night surface + a `/play/:slug` permalink. Real build not mounted yet. |
| Dev upload | ✅ done | Four steps: build → details → splits → publish. Preview gates the flow. Publishing pushes into the in-memory catalog, so the new game really appears. |
| Studio profile | ✅ done | Games, ENS name, stats, and credits derived from splits. |
| Agent setup | ⬜ next | Pick a game, set a trigger price, fund the agent's wallet. Show balance and status. Judges are told to look for this one. |
| Swipe discovery | ⬜ maybe | "Surprise me". Genuinely differentiating, pure frontend. Not on the critical demo path. |

Smaller pieces still open, roughly in priority order:

| Piece | Where | Notes |
|---|---|---|
| Write-a-review flow | Game listing | Ownership-gated. Only meaningful once a purchase has happened, which it now can. |
| Your library | Header / new route | Games you hold keys for. Currently only reachable via the listing. |
| "Why we built this" modal | Catalog hero | The button exists and does nothing. This is where the censorship story lives — deliberately not on the shopfront. |
| Report flow | Game listing | Button exists, no modal behind it. |
| Real build in the player | `GameStage` | Swap the placeholder for an `<iframe>`. Needs an actual open-source HTML5 game — don't build one. |
| 404 / route shell | `App.tsx` | Everything unknown currently redirects to `/`. |

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

### Copy rules that keep getting broken

- **No em dashes in any user-visible string.** Not in headings, body, hints, labels, placeholders, empty states, or aria-labels. Use a full stop and a second sentence, or a comma. An em dash is almost always a sentence doing two jobs; split it. Code comments are exempt.
- **Don't over-explain.** Say a thing once. The reader is not stupid, and a paragraph justifying a feature reads as insecurity. "Locked at publish. Every sale divides automatically." is finished; the three-clause version explaining who cannot change it and why is not better.
- **Don't argue the pitch on the shopfront.** Censorship, card networks and why-we're-different belong behind "Why we built this" on the landing page, not sprinkled through the catalog and listings. Everywhere else this is an ordinary games store.

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

**Stage:** Buyer and dev paths both complete on mock data
**Deps installed:** React 19, Vite 8, Tailwind v4, react-router-dom, lucide-react, clsx + tailwind-merge, `@iconify-json/streamline-freehand` (dev)
**Screens built:** catalog (`/`), listing (`/game/:slug`), checkout overlay, player (`/play/:slug`), publish (`/publish`), studio (`/studio/:id`)
**Deployed:** no

**Working end to end, both directions:**
- **Buy:** browse → filter/sort/search → listing → buy → sign in → fund → pay → key mints → the game boots in the same tab. The listing then shows the owned state and the header shows your balance.
- **Publish:** drop a zip → see it running → details, cover, price → splits by email totalling 100% → publish. **The game is then actually in the catalog** with a working listing and studio page.

All from `src/mocks/`. `npm run lint` and `npm run build` are both clean.

**Next up:**
1. **Agent setup screen** — judges are specifically told to look for the autonomous-purchase story, so it must be legible, not buried.
2. The smaller open pieces listed in §1 (write-a-review, library, the USP modal, report).
3. Install Impeccable and run `/impeccable audit` per screen.
4. Later, as a deliberate phase: Privy, then the API, then the x402 download path.

### Layout of the repo

```
scripts/build-icons.mjs   extracts only the Freehand icons we use → src/components/icons/freehand.gen.ts
src/styles/tokens.css     the whole design system. DESIGN.md §12 lives here.
src/mocks/                types.ts mirrors the API contract; games.ts is the fake
                          backend; session.ts is the Privy stand-in (a tiny
                          useSyncExternalStore store — sign-in, balance, keys)
src/lib/                  cn(), and format.ts for every ledger value
src/components/           CoverArt, GameCard, SplitBar, HeroCollage, GameStage,
                          Logo, ScrollManager, SiteHeader/Footer,
                          checkout/, publish/, icons/, ui/
src/routes/               Catalog, GameListing, Player, Publish, Studio
```

Integration seams are marked `TODO(integration)` — grep for it. They are: Privy login, Privy funding, the x402 payment call, and the real game build in `GameStage`.

Run `npm run icons` after adding a name to `WANTED` in `scripts/build-icons.mjs`. The script fails loudly if an icon isn't in the free set — several obvious ones aren't.

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
| Routing | `react-router-dom` v7, `BrowserRouter` | Decided when the second screen landed, as planned. Nothing exotic needed. |
| Icon delivery | Build-time extraction into `freehand.gen.ts` | `@iconify/react` fetches icon data at runtime and importing the whole set costs 2.6MB. We use ~11 icons; extracting them ships ~28KB and needs no network. |
| Loading state | Results tagged with the query that produced them | `react-hooks` v7 forbids synchronous `setState` in an effect. Stale results read as "loading" during render instead, which also fixes the flash when filters change fast. |
| Cover art | Deterministic generated SVG from `coverSeed` | Real art comes from devs at publish. Until then the catalog has to look intentional rather than sparse (brief, priority 3). |

### Log

_Newest first._

#### 2026-09-05 (split dial + copy pass) — Suparno
- **Did:** Publish now scrolls to the top on step change (steps are state, not routes, so `ScrollManager` never saw them). Added `SplitDial` to the splits editor: draggable dividers with keyboard support, number inputs kept for precision. Stripped every em dash from user-visible copy and wrote the rule into §2 here and DESIGN.md §10. Removed the Streamline credit from the footer.
- **⚠ Open:** the Freehand icons are **CC BY 4.0 and the required attribution is now nowhere in the app**. `TODO(attribution)` in `SiteFooter.tsx`, DESIGN.md §13. It needs a home before this ships publicly — an about page, a colophon, or a credits line all work.

#### 2026-09-05 (studio identity) — Suparno
- **Did:** Moved the dev identity into the session store (`studioId` + `handle`) instead of hardcoding it in `Publish.tsx`. Header now has a **Your studio** link; the studio page marks itself as yours and swaps its copy and CTA accordingly; the publish success screen links there too.
- **Note:** `studioId` is mocked as always present. A real signed-in buyer with no studio should be routed through studio creation before `/publish` — marked `TODO(integration)`, currently it falls back to Tin Roof so the flow stays testable.

#### 2026-09-05 (publish + studio) — Suparno
- **Did:** `/publish` — a four-step flow (build → details → splits → publish) with a real dropzone, a build preview that gates the rest of the flow, a generated cover with a shuffle, price/free toggle, and the splits editor. `/studio/:id` — games, ENS name, stats, and credits.
- **Works now:** Publishing pushes into the in-memory catalog via `publishGame()`, so a game you make appears in the grid with a working listing and studio page. Good for testing the other screens with your own data; it resets on reload.
- **Decisions:** people you've already shipped with are added **by name** from the studio roster (one click); only someone genuinely new needs an **email**, and they claim a wallet on accept. Requiring wallets up front would kill the jam-team case, which is the whole reason the feature exists. Studio credits are derived from the splits across their published games rather than a members table; it's more honest and it's data the listing already shows publicly.
- **Known gap:** the build preview shows the generated cover, not the actual dropped zip — we don't unpack anything client-side. Marked `TODO(integration)` in `Publish.tsx`; it becomes an iframe over the unpacked build.
- **Next:** Agent setup screen.

#### 2026-09-05 (checkout) — Suparno
- **Did:** Built the critical path. `src/mocks/session.ts` replaces the old `mockSession` object with a real reactive store (sign-in, wallet balance, held keys). `CheckoutOverlay` runs sign in → fund → confirm → pay, then the lights-down wipe. `GameStage` is the night play surface; `/play/:slug` is the owned-game permalink. Header now shows email + balance when signed in.
- **Works now:** The whole buyer journey, end to end, on mocks. Balance starts at $0 so the fund step is part of the default first run.
- **Decision — overlay, not a route:** the promise is "boots in the same tab, seconds later." A navigation unmounts the page and breaks exactly what we're claiming, so checkout is an overlay over the listing and the wipe happens in place. `/play/:slug` exists separately for replaying something you already own.
- **Next:** Dev upload + splits editor.

#### 2026-09-05 (review pass 2) — Suparno
- **Did:** Logo locked to **Fold** (`DEFAULT_MARK` in `src/components/Logo.tsx`); reworked its dog-ear as a true cutout with an outlined flap so it carries no background-colour dependency, and did the same to `stub`. New favicon. Added `ScrollManager` — Router keeps scroll across navigations, which is why listings opened halfway down; it also now honours hash links, so the hero CTA actually reaches the grid. Fixed "Split 1 ways" → "One person", with matching footer copy. Replaced the hero headline.
- **Headline:** was "Press play. That's the whole install." — cut, because instant browser play is table stakes (itch, Poki, CrazyGames all do it). Now **"The money goes where you think it goes."** The money reaching everyone who made it, immediately and split correctly, is the thing itch structurally cannot do — a ten-year-old open issue for splits, plus multi-week payout holds.
- **Next:** Checkout → instant play.

#### 2026-09-05 (review pass) — Suparno
- **Did:** Fixed the split bar never rendering (Tailwind `scale-x-0` multiplying against the animated `transform` — written up in [DESIGN.md §4](DESIGN.md) as a trap that will recur). Rebuilt the catalog hero: new headline, yellow Tone C ground, a fanned-deck graphic built from real covers, big CTA. Removed the "What you get" panel from every listing and cut the over-explaining copy on splits, reviews and the footer. Replaced the red dot in the header with a real logo mark; added six candidate marks and a favicon.
- **Works now:** As before, plus a hero that doesn't lead with the censorship story and a listing that states things once instead of three times.
- **Next:** Pick a mark (six options in the artifact), then checkout → instant play.
- **Open placeholder:** the hero's "Why we built this" button has no handler — it's for the USP modal, deliberately not built yet.

#### 2026-09-05 (later) — Suparno
- **Did:** Stripped the Vite template. Installed Tailwind v4 and wired `src/styles/tokens.css` as the single source of design values. Added the `@/*` alias to both `tsconfig.app.json` and `vite.config.ts`. Built the icon extraction script, then the primitives (Button, PriceChip, Sticker, Reveal, Freehand, CoverArt), the composites (GameCard, SplitBar, SiteHeader, SiteFooter), and the first two screens.
- **Works now:** Catalog and game listing, fully on mock data. Filter, sort, free-only, search, empty state, loading state, 12 games, generated cover art, animated split bars, verified-purchase reviews. Lint and build clean.
- **Next:** Checkout → instant play.
- **Notes for the other side:** `src/mocks/types.ts` is my read of the API contract — **worth a five-minute check before I build anything else against it.** Specifically: does `GET /api/games/:id` return the split members with handles and roles, or just addresses and percentages? The listing page shows them publicly, which I think is a feature worth keeping. Also still need the x402 helper walkthrough before checkout integration.

#### 2026-09-05 — Suparno
- **Did:** Read the product docs. Landed and locked the design language (Paper Arcade) — palette, type, physics, seven-move motion system, icon strategy, tone B/C split, banlist. Wrote `DESIGN.md` and this file.
- **Works now:** Nothing runnable beyond the stock Vite template. The design language exists as a live interactive reference artifact plus `DESIGN.md`.
- **Next:** Strip the template, install Tailwind v4 + tokens + fonts + icons, then catalog and game listing on mock data.
- **Notes for the other side:** None yet.

---

## 5. Session protocol

**At session start:** read §4 — current status, blockers, and the most recent log entry. Read [DESIGN.md](DESIGN.md) before touching UI.

**At session end:** append a log entry (what changed, what works now, what's next, anything Kai needs to know), update the status block, add or clear blockers, and record any new decision in the decisions table. Append; never rewrite history.

**Never commit `.env` or a private key.** Check `.gitignore` covers it before the first commit in any new package.
