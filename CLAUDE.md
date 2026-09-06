# CLAUDE.md — CGS-client

Working rules for this repo. Read before writing any code.

**This is the frontend repo only.** CGS is a **multi-repo** project, not a monorepo:

| Repo | What | Our access |
|---|---|---|
| `CGS-client` | ← you are here. Vite + React web app. | read / write |
| `CGS-server` | Node + Express + Drizzle + Hedera. Kai's. | **read only** |
| `CGS-docs` | Product story and shared progress log. | read only, **except `PROGRESS-LOG.md`** |

Never write to `CGS-server`, and never to `CGS-docs` beyond `PROGRESS-LOG.md`, which is the shared handover and is meant to be written to from both sides. Read from them freely:

| File | What |
|---|---|
| `../CGS-docs/README.md` | The product story and the three claims that have to be true in code. |
| `../CGS-docs/PROGRESS-LOG.md` | Shared status, blockers, open questions, the API contract in both directions. **Read this at session start** and add a frontend entry at session end. |

> The ideation and technical docs that used to live in `CGS-docs` are gone; `README.md` carries the product story now and `PROGRESS-LOG.md` carries the contract. There is no `CGS-docs/CLAUDE.md` any more either. If someone re-adds them, update this table.

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
| Checkout | ✅ done | Overlay, not a route. Sign in → fund → pay → mint → boot. **Real:** x402 on Hedera, signed by the buyer's own wallet in the tab. |
| In-browser player | ✅ done | `GameStage` on the night surface + a `/play/:slug` permalink. Runs the real purchased build. |
| Dev upload | ✅ done | Four steps: build → details → splits → publish. **A dropped zip actually runs in the page.** Publishing pins to IPFS and mints a real token. |
| Studio profile | ✅ done | Games, ENS name, stats, and credits derived from splits. |
| Agent setup | ✅ done | **On the game listing, not a page of its own.** Set a trigger instead of buying, fund its wallet there. |
| Swipe discovery | ⬜ maybe | "Surprise me". Genuinely differentiating, pure frontend. Not on the critical demo path. |

Smaller pieces:

| Piece | Status | Notes |
|---|---|---|
| Write-a-review flow | ✅ done | Ownership-gated, appears on the listing only if you hold the key. |
| Your library | ✅ done | `/library`. Owned keys as ticket stubs, plus the triggers you're waiting on. |
| "Why we built this" modal | ✅ done | Catalog hero. Where the censorship story lives, deliberately off the shopfront. |
| Report flow | ✅ done | Modal with reasons, confirmation state. |
| Real build in the player | ✅ done | Client-side unzip plus a service worker; see §3. |
| 404 | ✅ done | A real page, not a redirect. Bouncing to `/` hid broken links. |
| Studio creation | ✅ done | `/studio/new`, and `/publish` shows it as step 0 when you have none. |
| Teammate invite | ✅ done | `/invite/:id`. The other end of the splits editor. Reachable signed out. |
| Notifications | ✅ done | A panel in the header, not a page. Sales, invites, agent buys, publishes. |

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

### Information architecture

Everything about you lives behind the profile control in the top right. Two pages, one action, and the wallet inline. Keep it that way:

| Where | What | Why there |
|---|---|---|
| `/library` — **Your games** | Keys you hold, plus triggers you've set | A trigger is a game you're trying to get, so it sits beside the ones you got. **This is why there is no agents page.** |
| `/studio/:id` — **Your studio** | Games you made, your team, ENS name | Team and credits are public facts about the studio, not private settings. |
| `/publish` — **Publish a game** | The upload flow | An action, not a place. A menu item, never a tab. |
| The menu itself | Email, balance, add funds, sign out | There is nothing else to configure, so a settings page would be an empty room. |
| The bell, beside it | Sales, invites, what your agents did | **A panel, not a page.** Every row points at something that already has a home, so a `/notifications` route would be a room you pass through on the way somewhere else. |

Price triggers are set **on the game listing**, under the buy box, not on a page of their own. Buying and setting a trigger are the same decision made two ways.

`/invite/:id` is a landing page, not part of the IA. It is where an emailed link drops someone who may never have seen the site, so it explains itself and then gets out of the way.

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

**That mock-data phase is over.** It ran from the first screen to 6 Sep 2026 and did its job; the note that used to be here said not to add Privy or fetch `/api`, and both of those are now how the app works. Kept as history because the shape it left behind explains the code:

> ~~We are building the entire UI on mock data first. No backend connection, no Privy, no wallet, no chain, no x402. Every screen renders from local fixtures. Do not add `@privy-io/react-auth`, `wagmi`, `viem`, or any fetch to `/api` yet.~~

**We are now integrating, one workflow at a time.** Build one path end to end, test it in a browser, then start the next. Not a layer at a time: that leaves every screen half-wired and nothing testable.

- **Real:** browse, sign in, library, notifications, studio creation with ENS, publish, and buy-and-play. Money, GameKeys and builds are all genuine.
- **Still on mocks:** reviews, reports, `/invite/:id`, the agent. `src/mocks/games.ts` survives only to serve those; everything else reads `src/api/`.
- `src/api/` holds one module per area over `src/lib/api.ts`. `src/api/wire.ts` is what the server sends, `src/mocks/types.ts` is what components are written against, and `src/api/adapt.ts` is the only file that knows both. An API change is a diff in those three.
- **Money:** integer `*Units` for anything compared or added, float `*Usd` for display only. `Game` carries both.
- The seam left in a screen is still marked `TODO(integration)`. Grep finds what's left.

---

## 4. Progress — this repo only

> Shared cross-team status lives in `../CGS-docs/PROGRESS-LOG.md`. This section is the frontend's own.
> Append; don't rewrite history. Keep the status block current.

### Current status

**Stage:** Integrated against the live API, six workflows deep. Real money, real GameKeys, real builds.
**Deps installed:** React 19, Vite 8, Tailwind v4, react-router-dom, lucide-react, clsx + tailwind-merge, fflate, `@privy-io/react-auth`, `@iconify-json/streamline-freehand` (dev)
**Screens built:** catalog (`/`), listing (`/game/:slug`), checkout overlay, player (`/play/:slug`), publish (`/publish`), studio (`/studio/:id` and `/studio/new`), library (`/library`), invite (`/invite/:id`), 404
**Deployed:** no. Needs `VITE_PREVIEW_ORIGIN` (§3) and a server with a persistent disk, since builds are now served from one.

**Working end to end, against the real backend:**
- **Buy:** browse → listing → buy → Privy sign-in → add funds → **pay, signed by your own wallet in this tab** → x402 settles on Hedera → the GameKey mints → the game boots in the same tab. Verified on testnet: $3.00 left the buyer, $1.71 came back as their split share, the key minted with serial 1.
- **Publish:** make a studio (real ENS subname on Sepolia) → drop a zip → see it running → details, cover, price → splits, including someone who has only an email → publish. The build is pinned to IPFS and a real HTS token is created.
- **Play:** the build is fetched from the API, unpacked in the browser and run on the isolated build origin. Same pipeline as the publish preview.

**Still on mocks:** reviews, reports, `/invite/:id`, the agent.

`npm run lint` and `npm run build` are both clean.

**Next up:**
1. `/invite/:id`, which is also what settles the payouts held for someone who hasn't accepted.
2. Reviews, likes and reports.
3. The agent.
4. Then Impeccable per screen, and swipe discovery if there is time.

### Layout of the repo

```
scripts/build-icons.mjs   extracts only the Freehand icons we use → src/components/icons/freehand.gen.ts
public/preview-host.html  runs on the build origin. Registers the worker and
public/preview-sw.js      writes/serves unpacked builds. See §3.
src/styles/tokens.css     the whole design system. DESIGN.md §12 lives here.
src/mocks/                types.ts mirrors the API contract; games.ts is the fake
                          backend; session.ts is the Privy stand-in (a tiny
                          useSyncExternalStore store — sign-in, balance, keys);
                          agent.ts, invites.ts and notifications.ts are the same
                          shape
src/lib/                  cn(), format.ts for every ledger value, buildPreview.ts
                          + previewHost.ts for running a real zip
src/components/           CoverArt, GameCard, SplitBar, HeroCollage, GameStage,
                          Logo, ScrollManager, SiteHeader/Footer, ProfileMenu,
                          NotificationBell, checkout/, publish/, play/, listing/,
                          icons/, ui/
src/routes/               Catalog, GameListing, Player, Publish, Studio,
                          StudioSetup, Library, InviteAccept, NotFound
```

Integration seams are marked `TODO(integration)` — grep for it. They are: Privy login, Privy funding, the x402 payment call, `POST /api/agents`, reviews, reports, and the agent's demo controls.

### Running a real game build in the page

A dropped zip is genuinely unpacked and run, with no backend:

1. `src/lib/buildPreview.ts` unzips with `fflate` and finds `index.html`, handling a single wrapper folder.
2. `src/lib/previewHost.ts` hands the files to a hidden iframe **on a second origin**, which writes them into the Cache API under `/__preview/<id>/…`.
3. `public/preview-sw.js` runs on that origin and answers any request under the prefix from the cache.
4. `BuildFrame` points a sandboxed iframe at the entry URL over there.

Serving from real URLs is what makes this work: the game's own relative paths, `fetch`, XHR, workers and WASM all resolve normally. URL rewriting cannot do that, which is why it wasn't used.

**Why the second origin.** The frame needs `allow-same-origin`, because every engine that touches `localStorage` or IndexedDB throws on boot without it (Godot, Unity, Construct). On our own origin that would let an uploaded game read the session and rewrite the page. On its own origin it is same-origin with itself and cross-origin with us, which is the property we actually wanted. Same shape as itch.io's `html-classic.itch.zone`.

- **Dev:** nothing to configure. `localhost`, `127.0.0.1` and `[::1]` are three origins on one machine; the app probes for whichever the dev server is listening on. Vite usually binds `[::1]` only, which is why it probes rather than assuming.
- **Deploy:** set `VITE_PREVIEW_ORIGIN` to a subdomain serving the same `dist/`. See `.env.example`. A configured origin that doesn't answer fails hard, on purpose. With nothing configured and no twin reachable it falls back to this origin, warns in the console, and the publish diagnostics say so on screen.

**The app's own origin owns no service worker.** `main.tsx` unregisters any it finds on start, because the version of this app that served builds from its own origin left one behind and it keeps controlling the page across reloads. DevTools shows the current origin's registration by default, so a stale one there looks exactly like the live one. The live worker is under **Service workers from other origins → See all registrations**.

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
| Build isolation | A second origin, probed in dev, `VITE_PREVIEW_ORIGIN` in prod | The frame needs `allow-same-origin` to boot most engines. Giving it an origin of its own is the only way to have both that and safety. §3. |
| Notifications | A header panel, no route | Every row points somewhere that already exists. A page would be a corridor. |
| Invite | Its own route, reachable signed out | It is the first thing a new person ever sees of CGS, arriving from an email. Gating it behind sign-in would ask for an account before saying why. |
| Integration order | One workflow end to end, then the next | A layer at a time leaves every screen half-wired and nothing testable. Each pass ends with something that either works in a browser or doesn't. |
| API layer | `src/api/*` over `src/lib/api.ts`, with `wire.ts` / `adapt.ts` / `types.ts` split three ways | Components stay written against a view model that suits them. When the API changes, the diff is in one file rather than a hundred screens. |
| Where a purchase is signed | The server freezes the transfer, the **browser** signs the hashes, the server settles | Privy will not let the server sign with a buyer's own wallet, and the ways around that ask for standing permission to move their money. The browser has always been able to sign for its own wallet. §3. |
| Where a build comes from | The API, unpacked in the browser onto the build origin | No IPFS gateway will serve one (Pinata refuses HTML on shared subdomains; public gateways can't find fresh CIDs). The CID still proves what a build is. |
| Boot sequences | Beats carry the work; their timings are floors, not durations | A sequence that runs to a script finishes before the payment does, and the shutter comes up on a game nobody bought. |
| Optimistic ownership | Local flag at settlement, replaced by the server's answer | The buyer is entitled the moment payment settles, and the GameKey lands seconds later. Never the source of truth: a reload asks the server. |

### Log

_Newest first._

#### 2026-09-06 (integration W1–W6) — Suparno

Six workflows, each built and tested end to end before the next started. Cross-repo detail is in `../CGS-docs/PROGRESS-LOG.md`; this is what only this repo cares about.

- **Did:** browse signed out, sign in, library and notifications, studio creation, publish, and buy-and-play. `src/mocks/session.ts` is deleted. `src/api/` is the new read/write layer; `src/mocks/games.ts` survives only for reviews, reports and the invite screen, whose turn hasn't come.
- **Privy would not bundle under Vite 8.** Its optional Solana/Abstract/Farcaster peers were being stubbed to empty modules, which fails as `MISSING_EXPORT` at build time. Fixed with a **CJS** Proxy stub aliased in `vite.config.ts` — ESM cannot answer arbitrary named imports, CJS can. Seven aliases, one file, `src/lib/unusedChainStub.cjs`.
- **Privy v3 nests `createOnLogin`** under `embeddedWallets.ethereum`, not `embeddedWallets`. The docs and INTEGRATION.md both say otherwise; the `.d.ts` is right.
- **`session.tsx` had to split into `session.ts` + `SessionProvider.tsx`.** `react-refresh/only-export-components` forbids a file exporting both a component and plain functions.
- **`react-hooks` v7 is stricter than it looks.** It rejects `setState` in an effect body (hit twice), reassigning a closed-over variable inside an async function created during render, and passing a ref into a function during render. Where two steps of a sequence need to hand something between them, the fix is a plain holder object created inside the `useMemo` — not a ref.
- **The boot sequence could pay twice, and this is the one to remember.** `LightsDown` had `beats` in its effect dependencies. A beat's own work changes what the app renders — a purchase updates the session, the parent re-renders, a new beats array arrives, and the effect tears down mid-payment and starts over. The second run would have charged the card again. Beats are now read through a ref and the sequence starts exactly once. **Anything that runs a real side effect on a timeline must not be restartable.**
- **`GameStage` no longer has a "Placeholder" branch that means two things.** It takes `playUrl`, falls back to `localBuildEntry` (a zip mounted in this browser, which is the publish preview), and only says "No build" when there is genuinely nothing to run.
- **Checkout's step is derived, not stored.** It used to sit on "sign in" after Privy's modal had already signed you in, because `phase` was initialised from the session once and never revisited.
- **`Player.tsx` asks the server whether you own the game**, instead of trusting `ownedGameIds`, which is per-session optimism and empty after a reload. A permalink to a game you own used to say you didn't.
- **`Game` gained `priceUnits`.** The funding step compared `balanceUsd < priceUsd`, and a wallet holding exactly the price of a game is where comparing floats decides wrong.
- **Note:** `npm run lint` does not typecheck. `npm run build` is what catches a missing field on a mock fixture.


#### 2026-09-06 (new mark) — Suparno
- **The logo changed.** `DEFAULT_MARK` is now **`saturn`**, a ringed planet. Fold was a flat page icon with no mass, and next to the name it read as a file, not a sanctuary. Fold is still in `MARKS` if this needs reversing.
- **How it is drawn:** the ring passes in front of the planet and out the other side, which in flat monochrome is the **symmetric difference** of the two shapes. Two masks, not a band painted in the background colour, so the mark still works on ink, on paper and on yellow. Favicon rebuilt to match at .85 scale.
- **Sizes moved up one step** (`h-8` header, `h-7` footer). Saturn fills its box sideways and runs about two thirds of its height, so the old square sizes made it look undersized beside the wordmark.
- **Bug, found on first look:** the mark rendered mirrored in the app. PIL's `Image.rotate` turns counter-clockwise, SVG's `rotate()` turns clockwise because its y-axis points down, so the same `16` in both files tilts the ring opposite ways. The SVG carries `-16`. Commented in both files, since it looks like a typo and will get "fixed" back otherwise.
- **Note:** the social assets live in `../social/` (outside every repo, untracked on purpose). `../social/marks.py` holds the same geometry drawn with Pillow. If the mark changes, change it in both.

#### 2026-09-05 (build origin, invites, notifications) — Suparno
- **⚠ Security debt cleared.** Uploaded builds now run on a **separate origin** (`src/lib/previewHost.ts` + `public/preview-host.html`), so the frame keeps `allow-same-origin` without being same-origin with the app. The cache and the service worker moved over there too, which is why writing a build is now a `postMessage` rather than a `caches.put`. Full reasoning in §3.
- **Found while building it:** Vite binds `[::1]` only on this machine, so the obvious `localhost` ↔ `127.0.0.1` swap silently fell back to the app's own origin. It now probes `[::1]`, `127.0.0.1` and `localhost` with a `no-cors` HEAD and takes the first that answers. Verified with `netstat` and `curl`, not assumed.
- **Did:** `/invite/:id`, the receiving end of the splits editor. It leads with the fact that the share exists whether or not you accept, since the split locked at publish. Declining is reversible.
- **Did:** notifications. A bell in the header with a panel, no route. Sales, invites, agent buys and publishes. Wired to real events where they exist (publishing, an agent firing, an invite arriving); studio sales are seeded on join and marked `TODO(demo)`.
- **Print, finally used.** It was in the tokens and on nothing. It belongs to ledgers, so it drives the notification rows and the agent's event log. Added a `.print-rows` container that reads `--i` off each child. Changed the token from `forwards` to `both`: with a stagger delay, `forwards` shows every row before its turn.
- **Removed:** the "join Tin Roof (demo)" hack on `StudioSetup`. The seeded invite does the same job honestly, and accepting it is what makes the teammate roster in the splits editor real.
- **Also:** `.gitignore` now covers `.env*`, and `.env.example` documents `VITE_PREVIEW_ORIGIN`.
- **Attribution has a home.** The Freehand CC BY 4.0 credit is a colophon at the bottom of "Why we built this", with the typefaces. That closes the last licence blocker. DESIGN.md §13.
- **Removed** `public/sample-game.zip` and the "or try a sample build" link. We test with real builds now, and a fixture that only ever proved the plumbing was earning its 4 files.
- **Cleanup:** the app now unregisters any service worker on its own origin at start, since the pre-refactor one survives reloads and looks live in DevTools.

#### 2026-09-05 (404, studio creation) — Suparno
- **Did:** `NotFound` replaces the catch-all redirect, and shows the path it failed on. `StudioSetup` at `/studio/new`, also rendered inline as "step 0 of 4" when a signed-in dev hits `/publish` without a studio. Optional ENS subname under `cgs.eth` with a mocked availability check; skipping it is a first-class path, since the whole flow works on a raw address.
- **Changed:** `session.studioId` now starts `null` like a real new account, instead of being pinned to Tin Roof. `signOut()` clears the wallet, keys and studio together rather than only the email.
- **Testing note:** because a fresh studio has no history, the teammate roster in the splits editor is empty. There's a "join Tin Roof (demo)" link on the setup screen, marked `TODO(demo)`, so that path stays reachable.

#### 2026-09-05 (listing columns) — Suparno
- **Fixed properly:** opening the price trigger still pushed About down. Explicit row placement was not enough, because a row-spanning grid item contributes its height to *every* row it spans, so the tall right column kept growing row 1. The left side is now `display: contents` on mobile (three grid items in one column, ordered gallery, buy, about) and a real flex column at `lg`, where each side flows on its own. Nothing on the left moves when the right grows.
- **Note:** `npx prettier` with no config rewrote a file to double quotes and semicolons, against the rest of the codebase. Added `.prettierrc.json` (`semi: false`, `singleQuote: true`). Prettier is not a dependency; if you run it, run it from the repo root so it picks that up.

#### 2026-09-05 (media, cover fix) — Suparno
- **Fixed:** the listing cover stretched whenever the right column grew (opening the price-trigger panel), leaving a band of empty paper under the image inside its border. It was a grid row stretching the cell; the gallery is now `self-start`. Border also dropped from 3px to 2px to match everything else — 3px is reserved for the landing hero and the play surface.
- **Did:** Screenshots and clips. `MediaGallery` on the listing (main frame plus a thumbnail strip, video supported), `MediaPicker` in publish. Files become object URLs, so real images and video genuinely display with no server. Star an image to make it the cover.
- **New `Cover` component:** renders uploaded art when there is any, the generated riso composition otherwise. Every surface goes through it (cards, listing, library, hero, play fallback) so nothing has to know which it is.
- **Seeded catalog games** get four derived placeholder frames from `mocks/media.ts`, so every listing has a gallery without shipping fake screenshots as assets.

#### 2026-09-05 (play sequence, fullscreen, profile menu) — Suparno
- **Did:** Extracted the lights-down wipe into `components/play/LightsDown.tsx` so **every** play runs it, not only a purchase. Owned games get their own beats (checking your key, loading build) with no payment theatre. Added a fullscreen control to `GameStage` with a one-shot "Press Esc to come back" hint. Collapsed the three nav links into a single profile menu.
- **IA decided** (written up in §2): two pages behind the menu, one action, wallet inline. Agents folded into `/library` as "Waiting on a price", which removed the orphan page rather than adding a profile page that would have duplicated both.
- **Note:** `/play/:slug` still exists as a permalink and now runs the same beats, but "Play now" from the listing and library opens an overlay instead of navigating, because the promise is that the page never goes away.

#### 2026-09-05 (agent on listing, build diagnostics) — Suparno
- **Did:** Moved the agent out of `/agent` and onto the game listing, under the buy box. Agents are now per game (`byGame` in `mocks/agent.ts`), so several listings can be watched at once. Added unpack progress and a diagnostics panel to `/publish`.
- **Fixed a real bug:** a Godot/Unity-style build booted to a black rectangle. Cause was the iframe sandbox missing `allow-same-origin`, which gives the frame an opaque origin, and every engine that touches `localStorage` or IndexedDB throws on boot with no visible error. See the security note in `BuildFrame.tsx`.
- **⚠ Security debt:** `allow-same-origin` on a same-origin build means the frame can reach the parent page. Fine for previewing your own build, **not** fine for running strangers' games. `TODO(security)`: serve `/__preview/` from a separate origin before this is public, the way itch.io uses `html-classic.itch.zone`.
- **Also:** the service worker now rescues absolute paths (`/build.wasm`) by retrying them inside the referring build, and reports every 404 back to the page so the publish screen can name the missing file.

#### 2026-09-05 (agent, library, real builds) — Suparno
- **Did:** `/agent` (setup plus status, with a demo control that stands in for a live price drop), `/library`, the ownership-gated review form, the report modal, and the "Why we built this" modal. Added real in-browser build running: `fflate` unzip into the Cache API, served by `public/preview-sw.js`, run in a sandboxed iframe. Added `public/sample-game.zip` as a test fixture.
- **Works now:** Drop a zip on `/publish` and the game plays right there. Publish it and it plays from its listing and from `/library` too.
- **Decision — the agent's demo control stays visible but marked.** It's boxed, dashed, and labelled "Demo controls, not shipping", with a `TODO(integration)`. The real trigger is a price change on the HCS topic seen through the Mirror Node; there's no way to exercise that yet, and an untestable screen is worse than an honestly-labelled one.
- **Next:** 404, studio creation, swipe discovery. Then Impeccable, then integrations.

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

**At session end:** append a log entry here (what changed, what works now, what's next), update the status block, add or clear blockers, and record any new decision in the decisions table. Append; never rewrite history.

**Anything the other side needs goes in `../CGS-docs/PROGRESS-LOG.md` instead**, not here. That means anything crossing the repo boundary, any decision that changes the contract, and anything only they can answer. Its header has the entry template, and entries there are tagged by side rather than by person. It's the one sibling-repo file we write to.

**Never commit `.env` or a private key.** Check `.gitignore` covers it before the first commit in any new package.
