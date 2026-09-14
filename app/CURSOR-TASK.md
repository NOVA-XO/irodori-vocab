# Cursor task — React UI for a Japanese-vocabulary study PWA

You are the **frontend/UI engineer**. Build the React UI for this app under
`app/src/ui/` ONLY. A backend engineer (Claude Code) owns `app/src/core/`
and the data — you **import and call** its exports, never edit them.

Project: `80-japanese/82-irodori-web/app` (Vite + React 18, already scaffolded).
The live production app is the vanilla-JS one in the parent folder — study
`../app.js`, `../app.css`, `../themes.css`, `../index.html` to see the exact
behavior and visual design you are reproducing. **Do not touch the parent
folder or `app/src/core/`.**

UI language is **Mongolian (Cyrillic)**. Match the existing app's copy.

---

## Hard boundaries (coordination — a second AI works here too)

- **Edit only `app/src/ui/`** (and `app/src/main.jsx` if wiring is needed).
- **Never edit** `app/src/core/*`, `app/package.json`, `app/vite.config.js`,
  or anything in the parent `82-irodori-web/` folder.
- **Do not run `npm install`** or change dependencies. If you need a library,
  STOP and ask — the default is no new dependencies.
- Commit small and often with clear messages. After you change files, note
  what you changed so the backend engineer can re-read them.

---

## Core API you build on (already provided / being provided in `app/src/core/`)

```js
// srs.js
import { BOXES, today, gradeCard, isDue, isNew, isLearned, mergeProgress } from '../core/srs.js';
//   gradeCard(progress, id, ok) -> NEW progress map (pure, no mutation)
//   isDue/isNew/isLearned(progress, id) -> boolean

// sanitize.js
import { cleanSettings, cleanProgress, defaultSettings, BOOKS, KGROUPS } from '../core/sanitize.js';

// storage.js
import { load, save, KEY_P, KEY_S, KEY_D, KEY_TH, KEY_C, KEY_DEV } from '../core/storage.js';

// data.js  (being ported by backend — assume this shape)
import { loadBook, loadN5, loadKana, loadKanji, loadAudioIds, BOOK_META } from '../core/data.js';
//   loadBook('starter'|'el1'|'el2') -> Promise<item[]>
//   loadN5()/loadKana()/loadKanji() -> Promise<item[]>
//   loadAudioIds() -> Promise<Set<string>>   (which ids have an mp3)

// session.js (being ported by backend)
import { buildQueue, buildChoices } from '../core/session.js';
//   buildQueue(pool, progress, { onlyDue, size }) -> item[]
//   buildChoices(cur, pool, deck, kmode) -> item[]  (4 options, similar-reading distractors)

// romaji.js (being ported by backend)
import { toKana, checkTyped } from '../core/romaji.js';
//   toKana(latin) -> hiragana string (live, for the type-mode input)
//   checkTyped(raw, item) -> boolean (is the typed answer correct)

// pitch.js (being ported by backend)
import { pitchTokens } from '../core/pitch.js';
//   pitchTokens(accent) -> array of {mora, high, drop} you RENDER (no innerHTML)

// sync.js + usage.js (being ported by backend)
import { syncOn, getProgress, putProgress, newCode } from '../core/sync.js';
import { usageTotals, pingUsage, statsPing } from '../core/usage.js';
```

If a function you need isn't listed, ask the backend engineer to add it to
`core/` — do not implement domain logic in the UI.

**Never** build HTML strings and inject them (`dangerouslySetInnerHTML`).
Render via JSX so React escapes everything. Japanese/user text is data.

---

## Data shapes (read-only, from the core loaders)

```
vocab item:  { id, lesson, section, jp, kana, accent, romaji, mn, ref }
kanji item:  { id, c, on:[], kun:[], mn, en, s, n, g, l, l1, l2, w }
kana item:   { id, hira, kata, romaji, mn, group }   // group: gojuon|dakuten|yoon
```

`progress` map: `{ [id]: { b, d, n, c, w } }` — b=box(0..5), d=due-day,
n=times seen, c=correct, w=wrong. Never write it directly; use `gradeCard`.

---

## Themes — KEEP the token architecture

There are 5 themes: `minimal` (default, GitHub-dark), `blue`, `space`,
`anime`, `rain`. A theme is CSS custom-property overrides on
`html[data-theme="..."]`. **Never hardcode a color** — read tokens:

```
--bg --card --paper --ink --ink-2 --ink-3 --line --line-2 --accent --seal
--ok --ng --ok-bg --ng-bg --shadow --r --box-bg --box-bd --box-r --box-pad
--btn-bg --btn-fg --sel-bg --sel-fg --track-h --jpd --jp --ui --mono
```

Port `../themes.css` into `app/src/ui/themes.css` (the theme token blocks).
Japanese serif is `var(--jpd)` (self-hosted Noto Serif JP — the fonts live
in the parent `fonts/`; keep self-hosted, no Google Fonts CDN). Add motion
tokens (see below) to the base `:root`.

---

## The 9 screens (reproduce behavior from `../app.js` / `../index.html`)

1. **home** — hero with the 3D rotating word-card ring; "Давталт эхлүүлэх"
   (review) button; big cards linking to irodori / jlpt / kana; streak +
   daily goal; a "Үргэлжлүүлэх" (continue last session) button.
2. **irodori** — pick lessons (1–18) of the active book (starter/el1/el2);
   book switcher; script (kanji/kana) and direction (jp→mn / mn→jp) toggles;
   4 mode buttons (flash/choice/type/listen) that start a session.
3. **jlpt** — N5 words (50 lessons) and kanji (by lesson or JLPT level);
   mode buttons.
4. **kana** — pick groups (gojuon/dakuten/yoon); 4 kana modes.
5. **study** — the card. Shows front; user reveals; grades (✓/✗) or answers
   (multiple-choice / typed / listen). Progress ring + counters (done/ok/ng).
   Missed cards requeue. This is the heart — make it feel great.
6. **done** — results: %, ✓/✗ counts, list of missed words, "Дахих"
   (retry missed) and "Дахин" (same session again).
7. **stats** (Явц) — progress across all decks: per-lesson/level bars,
   totals (seen / learned / total / % correct), tabs per deck.
8. **profile** — theme picker, sync (link a code across devices), usage
   stats, offline download, motion toggle, import/export backup.
9. **feedback** — bug/idea/other form → sync server.

Shared shell: a top bar (☰ menu, title "Мартчихлаа", profile), a slide-out
menu, and the theme picker. During study the ☰ becomes a back arrow.

---

## Make it DYNAMIC (the whole point of this rewrite)

The owner wants all four — this is where you add value over the vanilla app:

1. **Smooth transitions.** Screen-to-screen, card flip, answer reveal, and
   the ring→study "card pull". Recommend and implement ONE approach — prefer
   the **CSS View Transitions API** (`document.startViewTransition`) for
   screen changes; fall back to a CSS class crossfade where unsupported. No
   heavy animation library unless it clearly earns its bytes (ask first).
2. **Reactive live UI.** Progress ring, counters, streak, goal bar animate
   as state changes (React state → CSS transitions on transform/opacity).
3. **Interactive micro-interactions.** Swipe-left/right to grade on the study
   card (with a keyboard + button fallback); tactile button presses; the
   backdrop can react subtly to activity. Respect touch and mouse.
4. **Room for new surfaces.** Add a retention-focused home strip:
   "Өчигдөр 12 үг сурсан · өнөөдөр 8 давтах" using `progress` + `isDue`.
   (The vanilla app has zero retention hooks — this is genuinely new.)

### Motion rules (non-negotiable)
- Animate **only `transform` and `opacity`** for anything full-screen
  (compositor-only; no layout/paint thrash).
- Add motion tokens to `:root` and use them everywhere:
  ```
  --dur-fast:140ms; --dur:220ms; --dur-slow:420ms;
  --ease-out:cubic-bezier(.22,1,.36,1);
  --ease-in-out:cubic-bezier(.65,0,.35,1);
  ```
- **Respect `prefers-reduced-motion: reduce`** — under it, transitions
  collapse to near-instant (the base.css already has a global guard; keep
  any JS-driven animation gated on a `motionOK()` check too).
- Target 60fps on a mid-range phone. The signature 3D ring already exists in
  `../app.js` (`buildRing`, `RING_N`, `RING_R`) and `../app.css` (`.ring3d`,
  `.hero`, `.flyer`) — port and improve it, don't reinvent.

---

## Definition of done for your part

- All 9 screens render and navigate, reading real data via the core loaders.
- Themes switch live and every screen looks right in all 5.
- The study flow works for all deck×mode combinations the vanilla app has.
- Animations are smooth, compositor-only, and degrade under reduced-motion.
- Phone width (~400px) works; no horizontal scroll; 16px side gutter.
- No `dangerouslySetInnerHTML`; no new dependencies; core untouched.
- `npm run build` passes.

When you finish a screen or a meaningful chunk, commit it and tell the
backend engineer which files changed so they can wire logic + review.
