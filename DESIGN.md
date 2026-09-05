# Paper Arcade — the CGS design language

> **Read this before writing any UI in this repo.** It is not a style suggestion; it is the spec.
> Live reference (every rule here rendered and interactive): https://claude.ai/code/artifact/5f698fba-a85c-48c6-8430-0fab5d647bcd
> Project context: [CLAUDE.md](CLAUDE.md)

**Status:** locked, 5 Sep 2026. Name, tone, stack, palette, type and motion are all decided. Changes need a real reason, not a preference.

---

## 0. The one rule

**Chrome is ink. Colour is meaning.**

A storefront is a grid of loud, uncontrollable cover art. Loud chrome plus loud art equals mud. So every frame, border, heading and label is monochrome ink on warm paper, and accent colour is rationed to exactly four jobs: **money, ownership, the agent, and warnings.**

If a colour appears on screen and it isn't saying one of those four things, it's a bug.

Everything below is downstream of this.

## 0.1 Why this direction (so nobody re-opens it)

| Product constraint | Design consequence |
|---|---|
| "This must not look or feel like a crypto app" | Warm cream paper, printed ink. The exact opposite of dark-mode-first. Night is one surface, earned. |
| Grids of loud cover art we don't control | Monochrome chrome; colour rationed as above. |
| The word in the product name is *sanctuary* | Hand-drawn icons, print texture. Made by people. Print also reads as permanent, which is the pitch. |

---

## 1. Colour

Real Risograph ink values. They sit together without looking like a default theme because they *are* a real ink set.

### Ground and ink

| Token | Hex | Use |
|---|---|---|
| `paper` | `#FBF3E2` | Every ground. **Never pure white** — white is a screen, paper is an object. |
| `paper-sunk` | `#F1E5CC` | Recessed panels, table headers, stage bars. |
| `paper-deep` | `#E7D8B8` | Grid lines, hatching, placeholder blocks. |
| `ink` | `#16130F` | All borders, all headings, all primary text. Warm black — `#000` buzzes on cream. |
| `ink-soft` | `#6B6154` | Secondary text, captions, helper copy. |
| `ink-faint` | `#A79B86` | Dashed dividers, disabled states. **Never body text.** |
| `night` | `#14110D` | The play surface only. See §5. |

### Riso inks — each owns exactly one job

| Token | Hex | Owns | Never used for |
|---|---|---|---|
| `red` | `#F15060` | **Act now.** Buy, Publish, the live price. | Errors, decoration, headings. |
| `green` | `#00A95C` | **Money settled.** Split paid, GameKey held, balance funded, "it worked". | Generic success toasts unrelated to money. |
| `blue` | `#0078BF` | **The agent.** Autonomous purchase, everything it touches. | Anything a human clicks. Links. Focus rings are the one exception. |
| `yellow` | `#FFE800` | **Marker.** Highlighted words, corner stickers, "New". | A surface — it can't hold legible text. |
| `pink` | `#FF48B0` | **Attention.** Reports, moderation, all-sales-final notices. | Anything routine. Rare by design. |

**Blue belongs to the agent, and this is load-bearing.** Judges are told to look for the autonomous-purchase story. Giving it a colour nothing else may use means the demo reads at a glance: red things are humans spending money, blue things are software spending money.

### Contrast

- Body text is `ink` on `paper` (16.8:1). Secondary is `ink-soft` on `paper` (6.2:1).
- `paper` on `red`, `green`, `blue`, `pink` all clear 4.5:1 — those are the only four colours allowed to carry paper-coloured text.
- **`yellow` carries `ink` text only**, never paper.

---

## 2. Type

Three faces, three jobs. All Google Fonts, all free.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,SOFT,WONK,wght@9..144,0..100,0..1,400..900&family=Martian+Mono:wght@400;500;600;700&family=Public+Sans:wght@400;500;600;700&display=swap">
```

| Role | Face | Settings |
|---|---|---|
| **Display** — headings, game titles, buttons | **Fraunces** | `font-weight: 800`, `letter-spacing: -0.025em`, `font-variation-settings: "SOFT" 100, "WONK" 1` |
| **Body** — descriptions, reviews, dev copy | **Public Sans** | 400 / 500 / 600 |
| **Data** — anything off the ledger | **Martian Mono** | 400 / 500 / 700, `font-variant-numeric: tabular-nums` |

**The wonk is the point.** Fraunces with `WONK 1` and `SOFT 100` is a serif with its quirks turned up — it reads editorial and zine-made rather than tech. Do not ship it with the axes at default; that's a different, much more boring typeface.

### The mono rule

**Every value that came off the ledger is set in Martian Mono.** Prices, split percentages, token IDs, wallet balances, addresses, HCS timestamps, transaction IDs. This is semantic, not decorative: mono silently marks *"this is a fact from the chain, not our copy."* It also aligns numbers, which the splits screen needs.

Body copy is never mono. Headings are never mono. Micro-labels (uppercase, tracked) are mono.

### Martian Mono is wide — two consequences

1. **Long values truncate, never wrap.** Addresses render as `0x71C7…3e4F` with the full value in a `title` attribute and a copy affordance. An ENS name always wins over an address when one exists.
2. **Micro-labels drop to 10px** with `letter-spacing: 0.08em` (not the 11px/0.16em you'd use with a narrower mono), or they blow out their container.

### Scale

| Step | Size / line-height | Face |
|---|---|---|
| Display | `clamp(44px, 8vw, 86px)` / 1.02 | Fraunces 800 |
| H1 | `clamp(30px, 4.4vw, 46px)` / 1.05 | Fraunces 800 |
| H2 | 28px / 1.1 | Fraunces 800 |
| H3 | 22px / 1.15 | Fraunces 800 |
| Card title | 18px / 1.15 | Fraunces 800 |
| Body | 16px / 1.6 | Public Sans 400 |
| Small | 14px / 1.5 | Public Sans 400 |
| Data | 13px / 1.4 | Martian Mono 500 |
| Micro label | 10px / 1.3, `0.08em`, uppercase | Martian Mono 700 |

Running text caps at **66ch**. Headings get `text-wrap: balance`.

---

## 3. Physics

Five rules. Every screen is built from them — that's what makes a hundred screens feel like one product.

| Rule | Value |
|---|---|
| **Border** | `2px solid ink` on everything. `3px` on hero and the play surface. Nothing exists without an outline. |
| **Radius** | `10px` cards and buttons. `999px` chips and pills. Nothing else. |
| **Shadow** | Hard offset, **zero blur, ever**: `2px 2px 0 ink` / `4px 4px 0 ink` / `6px 6px 0 ink`. Interactive elements only — static text blocks get a border and no shadow. |
| **Press** | Hover: `translate(-1px,-1px)`, shadow grows to 6px. Active: `translate(2px,2px)`, shadow shrinks to 2px. `130ms ease-out`. The object has thickness. |
| **Rotation** | `-2°` to `2°` on **stickers and badges only** — three words or fewer. Never on cards, never on content, never on anything containing a sentence. Tone C (§6) relaxes this on the landing page only. |

---

## 4. Motion — seven named moves

Motion comes from the material: **paper doesn't fade in, it lands.** Naming them means every future screen animates consistently without anyone re-deciding.

| Name | Spec | Where |
|---|---|---|
| **Stamp** | 500ms `--ease-land`. From `translateY(-12px) scale(1.055)`, undershoot to `translateY(2px) scale(.995)` at 55%, settle. | Entry for every card, panel, stub, dialog. |
| **Register** | 850ms. Two offset colour plates (red `+8,-6`, blue `-7,+6`) converge to zero and fade out over an ink layer. | Page load on the wordmark; purchase confirmation. **Rare, so it stays special.** |
| **Deal** | 70ms stagger, left to right, each child running Stamp. | Catalog grids, split rows, review lists. |
| **Grow** | 550ms `scaleX(0→1)`, `transform-origin: left`. Staggered 160ms per segment. Labels fade in only after their segment lands. | Split bars, funding meters, agent balance. |
| **Print** | 300ms per row, 110ms apart, `clip-path: inset(0 0 100% 0) → 0` plus `translateY(-7px)`. | The HCS ledger, receipts, purchase history. In the app today: the notification inbox and the agent's event log. Use the `.print-rows` container and give each child its own `--i`. |
| **Watch** | Ping rings 2.6s + conic sweep 3.2s, both infinite. | **Agent only.** The one ambient loop in the product. |
| **Press** | 130ms, see §3. | Everything interactive. |

Plus **Wobble** — 500ms, `±6°`, hover only — on Freehand icons. A hand-drawn mark should feel drawn.

### Motion is per-part, never per-box

This is the rule that separates designed from generated. Hovering a game card moves **five parts on five timings**:

| Part | Movement | Timing |
|---|---|---|
| Frame | `translate(-3px,-3px)`, shadow → 6px | 220ms `--ease-land` |
| Cover art | `scale(1.07) translateY(-2px)`, clipped by the frame | 420ms `cubic-bezier(.2,.7,.3,1)` |
| Title | `translateX(4px)` | 240ms, +30ms delay |
| Studio | `translateX(4px)` | 240ms, +60ms delay |
| Price chip | `rotate(-3deg) scale(1.08)` | 300ms `--ease-pop`, +50ms delay |
| Sticker | `rotate(9deg) translateY(-4px) scale(1.07)` | 320ms `--ease-pop`, +80ms delay |

A single uniform scale-up is the tell that someone animated a box instead of an object. Same principle on the GameKey stub (halves separate at the perforation, key rotates `-32°`), the palette swatches (plate shifts off register), and the agent panel.

### Tailwind trap: `scale-*` vs `transform`

Tailwind v4's `scale-*`, `rotate-*` and `translate-*` utilities compile to the **standalone** `scale` / `rotate` / `translate` CSS properties, which *multiply* with any `transform` a keyframe animates. So `scale-x-0` as the base state of a `Grow` animation pins the element at zero width permanently and the bar never appears.

**Set the base state of an animated element with `transform`, in a real CSS class** — see `.split-seg` in `src/styles/tokens.css`. This applies anywhere a keyframe here animates `transform`, which is most of them.

### Motion discipline

- **One ambient loop, and the agent owns it.** Everywhere else, idle means still. A page that twitches while you read it is a page nobody trusts with money.
- **Entrances fire once**, on first scroll into view. `IntersectionObserver` + `unobserve` on entry. Never re-fire on re-scroll.
- **Easings:** `--ease-land: cubic-bezier(.18,.85,.32,1)` for arrivals, `--ease-pop: cubic-bezier(.34,1.56,.64,1)` for anything that should overshoot. No linear, no default `ease`.
- **`prefers-reduced-motion: reduce` kills all of it** and forces every animated element to its final state. Not optional.

---

## 5. Night — the lights-down moment

The store is paper. The game is dark. Crossing that line is the product's whole promise, staged.

- Night (`#14110D`) is used on **one surface only**: the in-browser player. It is not a theme, not a toggle, not a preference.
- The transition is a **600ms `clip-path` wipe** top-to-bottom, `cubic-bezier(.7,0,.2,1)`, over the same tab. No reload, no route change that unmounts the page.
- The wipe **covers chain latency**, which is the whole trick — the wait becomes the show instead of a spinner. Beat structure: `Paying $3.00 USDC…` → 750ms → `Minting GameKey…` → 650ms → `Booting build from IPFS…` → 700ms → `Playing`.
- The game canvas scales in with `--ease-pop`; the `✓ Key minted` line lands last, in green.

Per the frontend brief this is the highest-value polish in the product. Budget real time for it.

---

## 6. Tone — one language, two dials

Same tokens, same motions, volume set by whether cover art is present.

**Tone B — the app.** Catalog, game listing, checkout, player, upload, studio profile, agent. Paper ground, radius 10, borders 2px, **no rotation on content**, stickers allowed at `±3°`. Chrome frames and gets out of the way.

**Tone C — the landing page, empty states, 404.** Coloured grounds (yellow, red, blue) are allowed. Cards may rotate. Freehand icons run at full size as decoration. No cover art to fight, so the volume goes up. Same palette, same physics, same motions.

This is one design system with a knob, not two systems. If a screen has game art on it, it's B.

---

## 7. Icons — two tiers, and the rule that keeps them apart

### Tier 1 — character: Streamline Freehand

```bash
npm i -D @iconify-json/streamline-freehand
```

1,000 icons, **CC BY 4.0** — attribution in the footer and README is the entire licence cost. Hand-drawn, variable-weight, rounded terminals. This is the single biggest thing separating CGS from every other neo-brutalist site.

Used **large, 32px and up**: empty states, the upload dropzone, the agent screen, category markers, feature callouts, landing-page decoration. `fill: currentColor`, so it takes the semantic colour of its context.

Verified names in use: `video-game-controller`, `business-deal-handshake`, `lock-key-1`, `share-radar`, `upload-brackets`, `receipt`, `money-wallet`, `security-shield-wall`, `search-magnifier`, `tag-sale-price`.

### Tier 2 — functional: Lucide

MIT, complete. Used **small, 16–20px**, at `stroke-width: 2.5` to match the ink weight: close, chevron, plus, check, menu, filter, trash, external-link.

**This split is not a preference — the free Freehand set genuinely has no plain X, plus, chevron, check, or trash.** It's an illustration set, not a UI set.

### The rule

**Never place a Freehand icon and a Lucide icon in the same visual group at the same size.** Freehand is big and speaks; Lucide is small and disappears. Break this and it looks like an accident, not a system.

---

## 8. Component specs

### Game card
Cover art in a `2px` ink frame with `overflow: hidden` on the wrapper so the hover scale clips. Title (Fraunces 18px), studio (Martian Mono 11px, ENS name preferred), footer with price chip left and action right. Optional corner sticker rotated `3°`. Hover per §4.

### Price chip
Martian Mono 13px, `tabular-nums`, `2px` ink border, `999px` radius. Neutral on paper. `free` variant fills green. `buy` variant fills red when it *is* the CTA.

### Split bar
The signature component — this is the most differentiated feature in the product and deserves a bespoke component. Horizontal stacked bar, `999px` radius, `2px` ink border, `2px` ink dividers between segments. Segments in green / blue / pink. Names in mono beneath, aligned to their segment. Animates with **Grow**. **Read-only after publish — no edit affordance may exist anywhere.**

### GameKey
A **ticket stub**, not an NFT card. Two-column grid split by a `2px dashed` ink line, with circular notches punched at the perforation (top and bottom, `paper-sunk` fill, ink border). Left: title, owned-since date, token ID in mono. Right: green panel with the Freehand key icon. Hover runs **Turn**.

### Ledger / receipt
Martian Mono throughout, rows separated by `1px dashed ink-faint`, totals divided by a solid `2px` ink rule. Animates with **Print**. Ends with the HCS topic ID and a `PUBLIC` marker — the point is that anyone can verify it.

### Agent panel
Blue ground, paper text. Radar animation (**Watch**) top-right. **The trigger is written as a sentence, not a form**: *"Buy Moss & Rust the moment it drops below $2.00."* Balance in mono, labelled **"Left to spend · this is the cap"** — because the wallet balance *is* the cap, and saying so is the strongest answer to the obvious judging question.

### Empty states and dropzone
Tone C. Large Freehand icon, one sentence of plain copy, one action. Never a grey box with "No items found."

### Loading
Hatched placeholder blocks (`paper-deep` diagonal hatch) with `2px` ink borders, at the exact dimensions of the content they replace. **No shimmer.**

---

## 9. Banlist

Most of this UI will be written by an AI, and an AI drifts toward the mean unless it's fenced. This section is the highest-value part of this document.

- ✕ **Gradients, glassmorphism, `backdrop-blur`, blurred drop shadows.** Shadows are hard offsets or they don't exist.
- ✕ **Fade-in-up on scroll as the default entrance.** Paper lands. Use Stamp.
- ✕ **Ambient looping animation on anything but the agent.**
- ✕ **Purple, violet, neon-on-black, glowing anything.** The visual grammar of exactly what we tell judges we are not.
- ✕ **Chain links, cubes, hexagons, blockchain iconography.** Nothing should look like an explainer diagram.
- ✕ **"Connect Wallet" as a top-right primary button.** It says "Sign in", and it appears only when a purchase or upload actually needs it. Browsing never asks.
- ✕ **A raw `0x71C7…3e4F` where a name could go.** ENS first, studio name second, truncated address last — always mono, always with the full value available.
- ✕ **Centred hero with three feature cards under it.** Left-aligned, asymmetric. The catalog is the hero.
- ✕ **Skeleton shimmer loaders.** See §8.
- ✕ **Emoji as icons.**
- ✕ **Rotation on anything containing a sentence.**
- ✕ **Pure white (`#FFF`) or pure black (`#000`) anywhere.**
- ✕ **`border-radius` values other than 10px and 999px.**
- ✕ **The words** *seamless, revolutionary, unlock, empower, "powered by blockchain", "the future of".*
- ✕ **Any UI implying resale, refunds, or editable splits.** Hard product rule — but it is a design failure if a button ever suggests it.

---

## 10. Voice

Write from the user's side of the screen. Active voice. A control says exactly what happens: **"Publish"**, then a toast that says **"Published."**

**No em dashes in any user-visible string.** Headings, body, hints, labels, placeholders, empty states, aria-labels. Use a full stop and a second sentence, or a comma. An em dash is nearly always one sentence doing two jobs. Code comments and these docs are exempt.

**Say it once.** A paragraph justifying a feature reads as insecurity, and it assumes the reader needs convincing. "Locked at publish. Every sale divides automatically." is finished. The longer version naming who cannot change it and why is not better.

**Keep the pitch off the shopfront.** Censorship, card networks and why-we're-different live behind "Why we built this" on the landing page. Everywhere else this is an ordinary games store that happens to settle on-chain.

- Name things by what people recognise: *"Your games"*, not *"Owned GameKey tokens"*.
- Errors say what went wrong and how to fix it. No apologies, no vagueness.
- Chain mechanics are described in ordinary language or not at all. *"Paid straight to all three"* beats *"atomic multi-party settlement"*.
- **State the hard rules plainly rather than hiding them:** "All sales are final." "Splits lock when you publish and can never be changed — including by us." Owning them costs less than being caught by them.
- Hedera's style guide, for prose in READMEs and the landing page: *"public distributed ledger"*, not *"blockchain"*.

---

## 11. Accessibility

- Every interactive element has a visible focus state: `outline: 3px solid blue; outline-offset: 3px`. Blue is reserved for the agent everywhere *except* focus rings.
- Colour never carries meaning alone — the split bar has percentages, the ledger has labels, price state has text.
- `prefers-reduced-motion: reduce` is honoured throughout (§4).
- Wide content (tables, ledgers, the split editor) scrolls inside its own `overflow-x: auto` container. The page body never scrolls sideways.
- Icons that carry meaning get an accessible name; decorative ones get `aria-hidden="true"`.

---

## 12. Tokens — paste-ready Tailwind v4

`src/styles/tokens.css`:

```css
@import "tailwindcss";

@theme {
  /* ── ground & ink ── */
  --color-paper:       #FBF3E2;
  --color-paper-sunk:  #F1E5CC;
  --color-paper-deep:  #E7D8B8;
  --color-ink:         #16130F;
  --color-ink-soft:    #6B6154;
  --color-ink-faint:   #A79B86;
  --color-night:       #14110D;

  /* ── riso inks — semantic, see §1 ── */
  --color-red:    #F15060;  /* act now      */
  --color-green:  #00A95C;  /* money settled */
  --color-blue:   #0078BF;  /* the agent    */
  --color-yellow: #FFE800;  /* marker       */
  --color-pink:   #FF48B0;  /* attention    */

  /* ── type ── */
  --font-display: "Fraunces", Georgia, serif;
  --font-body:    "Public Sans", "Segoe UI", system-ui, sans-serif;
  --font-mono:    "Martian Mono", ui-monospace, monospace;

  /* ── physics ── */
  --radius-card: 10px;
  --radius-chip: 999px;

  --shadow-hard-sm: 2px 2px 0 #16130F;
  --shadow-hard:    4px 4px 0 #16130F;
  --shadow-hard-lg: 6px 6px 0 #16130F;

  --ease-land: cubic-bezier(.18, .85, .32, 1);
  --ease-pop:  cubic-bezier(.34, 1.56, .64, 1);

  /* ── motion ── */
  --animate-stamp: stamp .5s var(--ease-land) backwards;
  --animate-grow:  grow .55s var(--ease-land) forwards;
  --animate-print: printrow .3s ease-out both;   /* `both`, not `forwards`:
                                                    with a stagger delay,
                                                    `forwards` shows every row
                                                    before its turn. */
  --animate-sweep: sweep 3.2s linear infinite;
  --animate-ping-ring: ping 2.6s ease-out infinite;
  --animate-wobble: wobble .5s ease-in-out;

  @keyframes stamp {
    0%   { opacity: 0; transform: translateY(-12px) scale(1.055); }
    55%  { opacity: 1; transform: translateY(2px) scale(.995); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes printrow {
    0%   { opacity: 0; transform: translateY(-7px); clip-path: inset(0 0 100% 0); }
    100% { opacity: 1; transform: translateY(0);    clip-path: inset(0 0 0 0); }
  }
  @keyframes sweep { to { transform: rotate(360deg); } }
  @keyframes ping  { 0% { transform: scale(.45); opacity: .65; } 100% { transform: scale(2); opacity: 0; } }
  @keyframes wobble { 0%,100% { transform: rotate(0); } 30% { transform: rotate(-6deg); } 70% { transform: rotate(6deg); } }
}

@layer base {
  html { font-family: var(--font-body); }

  body {
    background: var(--color-paper);
    color: var(--color-ink);
    -webkit-font-smoothing: antialiased;
  }

  /* paper grain — one fixed element, 5.5% */
  body::before {
    content: ""; position: fixed; inset: 0; z-index: 9999;
    pointer-events: none; opacity: .055;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  h1, h2, h3, h4 {
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: -.025em;
    font-variation-settings: "SOFT" 100, "WONK" 1;   /* non-negotiable — see §2 */
    line-height: 1.05;
    text-wrap: balance;
  }

  :focus-visible {
    outline: 3px solid var(--color-blue);
    outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation: none !important;
      transition-duration: .01ms !important;
    }
  }
}
```

**No magic numbers in components.** If a value isn't in this block, it doesn't go in a component — add it here first.

---

## 13. Attribution (required, satisfied)

The Freehand icon set is CC BY 4.0, which requires a visible credit naming the set with a link to streamlinehq.com.

**It lives in the colophon at the bottom of "Why we built this"** (`WhyModal.tsx`), alongside the typefaces. It was in the footer until 5 Sep 2026, then moved: a modal about how the thing was made is where a colophon belongs, and it keeps a credits line off every shelf in the shop.

If that modal is ever cut or the icon set is swapped, the credit moves with it. It is a licence condition, not decoration.

Wording:

> Icons by [Streamline](https://streamlinehq.com), Freehand set, CC BY 4.0.

---

## 14. Enforcement

Once this file exists, install [Impeccable](https://impeccable.style):

```bash
npx impeccable install
/impeccable init      # writes PRODUCT.md, reads this file as DESIGN.md
/impeccable audit     # ~60 deterministic detectors for the §9 banlist
/impeccable critique  # per-screen design review
```

**Order matters.** Impeccable does not generate UI — it enforces a system you already have, inheriting your tokens and components. Installing it first and asking it to design wastes it. Run `audit` after each screen lands.
