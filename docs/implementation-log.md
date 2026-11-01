# Implementation log

## Perf phase — design-review items 10–13

- **10 — Done.** Tailwind 3.4 now compiles through PostCSS (`tailwind.config.js`, `postcss.config.js`, `styles/app.css`); the Play CDN and unused import map are gone, arbitrary values still render, and the shipped CSS is 32.6 KB (6.4 KB gzip).
- **11 — Done.** `ContentScreen` is a lazy chunk, each essay body is a per-slug dynamic import, posts/media data load on their tabs, and framer-motion uses `LazyMotion` + `m`; the menu path is 97.2 KB gzip against the 120 KB target.
- **12 — Done.** Jost and JetBrains Mono are self-hosted woff2 with preload and `font-display: swap`, reading prose uses the display face, and the book cover, essay images, design logos, and post images carry renditions, `srcSet`/`sizes` where useful, dimensions, and lazy decoding.
- **13 — Done.** The background canvas caps DPR at 2, runs at 30 fps with cached gradients/sort/glow sprite and a cancelled RAF, and pauses behind boot/content, on `document.hidden`, and under reduced motion with a static frame; the content blur is removed and the CRT overlay is monochrome at roughly 4% and hidden for coarse pointers/reduced motion.

### Bug-scan fixes

- **PF-01** — Removed the 407 KB Tailwind Play CDN script and compile the stylesheet at build time.
- **PF-02** — Split the single 461 KB bundle into the menu, content shell, tab data, and essay chunks.
- **PF-03** — Capped the canvas backing store at DPR 2, cancelled its RAF, and stopped the loop when covered or hidden.
- **PF-04** — Replaced blocking Google Fonts with two preloaded, self-hosted variable fonts (`font-display: swap`) and moved prose to Jost.
- **PF-05** — Posts render 20 at a time with lazy, dimensioned WebP/JPG images; essay and design images use renditions with dimensions.
- **CT-08** — Book cover now serves 320/640 WebP renditions with width/height and lazy loading; the 588 KB source is out of `public/`.
- **MS-02** — Removed the unused AI Studio import map and gave every SVG filter/gradient a `useId`-derived unique ID.

### Verification

`npx tsc --noEmit -p .` and `npm run build` pass. Headless Chrome at 390×664 (touch, DPR 3) and 1440×900 checked every menu section and content tab, essay and post loading, Show more posts (40 cards), font/image delivery, the background pause states, reduced motion, and horizontal overflow; the focused perf suite reports 33/33 passing, all screen checks pass, and measured CLS is 0.0019 on mobile and 0 on desktop. Keyboard Arrow/Enter navigation and Back to Home were rechecked after the `LazyMotion` change.

## Audio phase — design-review items 5–9

- **5 — Done.** `utils/Interaction.ts` is the single bus for `cursor | confirm | back | error | start`; menu, content, boot, and settings call `interact()` and no component imports the sound or haptic manager (the settings UI reads availability through `interaction.soundAvailable`).
- **6 — Done.** `SoundManager` synthesises a glassy cursor tick, rising two-note confirm bell, lower falling back blip, low error double-pulse, and a 200/300/450 Hz filtered boot pad with 520/780 Hz bell tails; voices route through a master gain and `DynamicsCompressor` with a three-voice cap, and the sub-bass boot sweep is gone.
- **7 — Done.** Haptics require a coarse pointer and the Vibration API, wait for `navigator.userActivation.isActive`, fire once per action via `pointerdown`/click, never on hover, are suppressed by reduced motion, and read `HAPTIC N/A` where the API is absent (iOS Safari is a no-op).
- **8 — Done.** A shared `SystemSettings` panel in the menu help bar and content footer persists sound, haptics, motion, and the hint in `jsb.prefs.v1`; buttons are 44 px with `aria-pressed` and a speaker icon, `M` toggles sound, changes are announced politely, and the one-line iOS/unavailable hint is dismissible.
- **9 — Done.** Cursor ticks follow selection changes on hover, focus, arrows, swipes, and tab changes, are deduped per id for 800 ms, throttled to 80 ms, skip focus right after pointer input, and ignore key repeat.

### Bug-scan fixes

- **HB-01** — The boot pad is requested only after the awaited context resume succeeds, and `playBoot` refuses to schedule unless the context is running.
- **HB-02** — `ensureRunning()` awaits `resume()` and waits for `running`; the newest gesture event is replayed if it is still fresh, and stale events are dropped.
- **HB-03** — `resumeIfPossible()` retries suspended/interrupted contexts on `visibilitychange` and `pageshow`, with the next pointer/key gesture as the fallback.
- **HB-04** — Persistent sound/haptics/motion controls replace the dead `isMuted`; muting ramps the master gain and stops the boot pad.
- **HB-05** — Touch activation now produces exactly one vibration (verified 22 ms confirm, 14 ms back); hover produces none, and a new pattern only cancels an older one that is still running.
- **HB-06** — Support detection requires the Vibration API and a coarse pointer; iOS shows `HAPTIC N/A` and makes no vibration call.
- **HB-07** — The hover carpet is gone: one tick per selection change, plus `onFocus` parity on menu cards/arrows, content rows, tabs, social links, and footer controls.
- **HB-08** — Confirm and back now differ in direction and timbre; the boot is a warm mid-range pad with glassy bells.
- **HB-09** — Cursor ticks are throttled/deduped, key repeat is ignored, and the voice cap plus compressor prevent node stacking.
- **HB-10** — The menu help bar shows one dismissible `iPhone: the Ring/Silent switch mutes site audio.` line (or the equivalent unavailable-browser line), persisted after dismissal.

### Verification

`npx tsc --noEmit -p .` and `npm run build` pass (menu path 101.9 KB gzip). Production preview at 390×664 touch and 1440×900 keyboard/mouse: zero layout shift on menu, content, and essay (mobile CLS 0), no horizontal overflow, no console errors. Verified no AudioContext before the first gesture, a running context after ArrowRight, one cursor tick per hover/selection, tab clicks deduped to one tick, rapid arrows throttled to one tick, mute persistence and silent Back, `M` announcements, suspend→visible/pageshow recovery, one vibration per mobile action, haptics persistence, hint dismissal persistence, and reduced motion disabling haptics. iOS-specific paths were emulated in Chromium (iPhone UA, coarse pointer, Vibration API removed), not tested on a physical iPhone.

## Boot phase — design-review items 1–4

- **1 — Done.** The boot now waits behind a real focusable `Power on` button (or any click/tap/key): the click calls `interaction.start()`, which awaits `soundManager.ensureRunning()` before `playBoot()`, so the pad begins with the bloom on the first gesture. If audio is missing, suspended, or the visitor skips, the visuals start immediately and the chime is never queued late. The gate is one screen and resolves in the same frame (before the 300 ms budget).
- **2 — Done.** Gesture→menu is 1.70 s: bloom and wordmark resolve by 1.35 s while the menu is already composited underneath, then a 350 ms crossfade; there is no black hold. Any non-modifier key, tap, or the 44 px Skip control ends it in ~200 ms; Escape is the skip key after start. `jsb.boot.v1` in session storage gives returning visitors a 340 ms fade with no gate.
- **3 — Done.** The scene is one designed stage: horizon/sky gradient, three depth bands of translucent monoliths (14 far, 12 mid, 10 near on desktop; 6/5/3 with larger widths on compact screens), slow dolly plus lateral drift, one warm-white bloom, and a resolving original monogram/wordmark (`components/Wordmark.tsx`). The same monogram ships as `/favicon.svg` (linked first, with the existing ICO/PNG icons kept as fallbacks). Palette stays PS2 blue with white/cyan; there is no purple cloud and no WebGL.
- **4 — Done.** Layout comes from a constant-seed mulberry32 generator built once in `useMemo`, so re-renders and StrictMode draw the same field. Every boot animation is `transform`/`opacity` on composited layers; per-element `filter: blur()` and the large blurred cloud divs are replaced by a single pre-blurred radial gradient, and the 36-element desktop / 14-element compact budget keeps the sequence under 50 ms tasks even at 4× CPU throttle. Reduced motion renders a static poster for ~420 ms.

### Bug-scan fixes

- **BT-01** — Replaced the 7.2 s unskippable boot with a gesture-gated 1.70 s sequence, skip from the first frame, a crossfade over an already-mounted menu, and no `mode="wait"` on the boot exit; local LCP is 84 ms desktop and 52 ms mobile, with the menu as the LCP element.
- **BT-02** — Removed both black holds: the last tower frame dims into the menu in the same blue field, the wordmark resolves instead of being removed, and the short session return fades straight from the poster.
- **BT-03** — Seeded the field once (no re-randomize on render or stage change), removed all 25 per-element blurs and both 600 px blurred clouds, cut to 10–14 towers on compact screens, and eliminated post-gesture long tasks.
- **BT-04** — Added a reduced-motion boot path (static poster, no dolly, no mark flight, ~420 ms total) alongside the existing reduced-motion background, menu, content, and haptics policies; the boot skip and progress affordances remain available.

### Verification

`npx tsc --noEmit -p .` and `npm run build` pass (main 321.49 kB / 103.20 kB gzip, CSS 38.76 kB / 8.15 kB gzip). Production preview checked with headless Chrome at 1440×900 keyboard/mouse and 390×664 / 390×500 touch: full boot 1.70 s, skip ~200 ms, session return ~290 ms, reduced motion ~420 ms, CLS 0 and no horizontal overflow at every size, deterministic 36/14 tower fields across reloads, zero AudioContexts before the gesture and one running context with the pad starting ~50 ms after it, no long tasks post-gesture at 4× CPU throttle, and menu/section/Back interaction after both a full boot and a skip. The Umami `script.js` 400 in the console is the pre-existing MS-01 analytics issue and is outside this phase.

## Nav phase — design-review items 14–17

- **14 — Done.** A dependency-free History-API router (`utils/router.ts`) gives every screen a canonical path, title, description, canonical link, OG/Twitter tags, `popstate` handling, and working Back/Forward; `public/404.html` stores a deep path and the router restores it before first render on GitHub Pages.
- **15 — Done.** Content screens and the 404 are modal dialogs with `aria-modal`, a labelled visible H1, initial heading focus, a Tab/Shift+Tab trap, Escape close, focus return to the invoking card, and essay list scroll plus selected-card restoration with a polite “Returned to Essays” announcement.
- **16 — Done.** Section screens grow from the selected card’s viewport point and shrink back to it; tab and essay changes slide ±18 px along the tab order while the header, tab bar, and help bar stay fixed; transitions are 180–240 ms on one `cubic-bezier(0.2, 0.8, 0.2, 1)` curve and disappear under reduced motion.
- **17 — Done.** One `HelpBar` renders real keycaps on fine pointers and short tap/swipe copy on coarse pointers, with only the current screen’s actions and a matching `sr-only` description; the duplicate 20 px footer arrows are gone, and menu/content/404 footers share one visual language and 44 px controls.

### Bug-scan fixes

- **NV-01** — Added path routes for all sections, portfolio/content tabs, and essays, with `pushState`/`replaceState`/`popstate`, per-route metadata, canonical URLs, and a GitHub Pages `404.html` fallback; Back from an essay returns to the list.
- **NV-02** — Menu Enter now ignores `defaultPrevented`, key repeat, and interactive targets, so Enter on Previous/Next moves the carousel instead of opening a section.
- **NV-03** — Removed the global Backspace shortcut; Escape closes the reader or screen, and explicit Back controls remain.
- **NV-04** — Content and 404 screens are labelled modal dialogs with focus entry, a Tab trap, Escape, background `inert`, and focus restoration to the originating menu card.
- **NV-05** — Opening an essay saves the list `scrollTop` and slug, and returning restores both, focuses the card, and announces “Returned to Essays”.
- **MS-03 (404 part)** — Added a branded in-app 404 route and `public/404.html` SPA fallback. Empty/loading/error states, skeletons, `robots.txt`, and `sitemap.xml` remain for their own phases.

### Verification

`npx tsc --noEmit -p .` and `npm run build` pass (main 331.04 kB / 106.56 kB gzip, content 48.00 kB / 11.98 kB gzip, CSS 40.40 kB / 8.49 kB gzip). Headless Chrome against the production preview at 1440×900 (keyboard/mouse) and 390×664 (touch, DPR 3) passes 66/66 checks: every route’s path/title/canonical, deep links after boot, browser Back/Forward, Escape and focus restoration, `inert` menu, Tab and Shift+Tab containment, Enter on Previous, Backspace neutrality, essay scroll/card restore, a reader-to-tab switch starting at the top with tab focus kept, tab direction plus fixed chrome, touch vs keyboard help copy, reduced-motion animation suppression, unknown essay slugs, a simulated GitHub Pages 404 response restoring `/deep-link/missing`, mobile 404 footer height 94.5 px, and no horizontal overflow. A final close-origin refinement (shrink toward the section card after a tab change) was rechecked with a focused 7/7 browser run covering the close animation, focus restoration, About dialog, and console. The known Umami `script.js` 400 (MS-01) remains and is outside this phase.

## Menu and tabs phase — design-review items 18–25

- **18 — Done.** `MainMenu` is now a PS2 system browser: a selected-item panel with icon, section name, the live `description`, and an `Open` control; a clock, thin rule, one help bar, and the orbit line as background texture; colour is held to PS2 blue plus white/cyan.
- **19 — Done.** The six icons are a labelled `role="listbox"` of `role="option"` items with `aria-selected`, one roving `tabIndex`, Arrow/Home/End, and Enter/Space to open; a 2 px white focus ring and polite section announcements are independent of the selected glow, and the global Enter shortcut is gone.
- **20 — Done.** The phone menu drags with the pointer and snaps on distance or velocity, uses `touch-action: pan-y`, handles `pointercancel`, keeps a neighbour peek plus counter/dots, gives Prev/Next 44 px targets and “Tap to open · Swipe to browse” copy, and centres a neighbour on the first tap; reduced motion disables dragging.
- **21 — Done.** Hover moves the selection and plays one cursor tick, click confirms the selected item, the stage has a real `perspective: 1000px`, tilt is reduced, and only the active icon gets the bright outline and glow. Hover now follows real pointer movement, so a moving row cannot steal a keyboard selection.
- **22 — Done.** One `Tabs` component serves Content and Portfolio with `tablist`/`tab`/`tabpanel`, ids, `aria-selected`, `aria-controls`, `aria-labelledby`, roving focus, Arrow/Home/End, a visible focus ring, and a 3×2 mobile grid that keeps Reading on screen.
- **23 — Done.** The panel is keyed by tab and slides 18 px in the tab direction while the header and tab bar stay mounted and still; the essay reader keeps its forward/back direction, and reduced motion removes the animation.
- **24 — Done.** Each tab has a count plus one-line description; Essays/Posts/Podcasts/Lectures have client-side search, Podcasts and Lectures add a year filter, Lectures group by year and venue, Value Stack groups by year, Posts and Value Stack disclose 20 at a time, and filtered lists have a clearable empty state.
- **25 — Done.** Media, posts, reading, socials, and projects share `SystemCard`: one anchor per linked item, rest/hover/focus/pressed states, a persistent external glyph with “(opens in a new tab)”, and lazy dimensioned images; the duplicated project icon/overlay anchors are gone.

### Bug-scan fixes

- **MN-01** — Menu sections are semantic options in a listbox, with selected state, roving focus, keyboard opening, a visible focus ring, and the section description rendered.
- **MN-02** — Menu arrows are 44 px on touch, the hint reads “Tap to open · Swipe to browse”, and text is no longer scaled below its real size (labels 12 px, descriptions 13 px).
- **MN-03** — Added `perspective: 1000px`, reduced tilt, made hover preview the selection, and made click confirm it.
- **CT-01** — Essay cards are single anchors that work with Enter, have a focus ring, and restore list focus/scroll after the reader.
- **CT-02** — Content tabs follow the ARIA tab pattern with roving focus and panel links, and the mobile 3×2 grid shows all six tabs.
- **CT-03** — Project cards are one anchor each; the duplicate icon/overlay links and clipped icon focus are gone.
- **CT-04** — Content/portfolio tab text, menu helper copy, Work location and headers, and the book subtitle now use measured high-contrast blues.
- **CT-05** — Menu arrows, footer Back, settings buttons, and “Get the Book” meet the 44 px touch target.
- **CT-06** — Portfolio Projects/Investments/Design use the shared `Tabs` component with roles, selection, panels, roving focus, and keyboard movement.
- **CT-07** — `mailto:` opens no blank tab, and external glyphs are persistent with visually hidden “opens in a new tab” text.
- **NV-02** — Removed the global Enter shortcut; Enter/Space belong to the focused option, and Enter on Prev/Next only activates that button.

### Verification

`npx tsc --noEmit -p .` and `npm run build` pass (main 327.94 kB / 105.20 kB gzip; content 50.33 kB / 14.09 kB gzip). Headless Chrome against the production preview at 1440×900 keyboard/mouse and 390×664 touch/DPR 3 checked: listbox and tab semantics with one tab stop, Arrow/Home/End/Enter/Space including after closing a screen, the 2 px focus ring, hover preview then click confirm, stationary-pointer stability, 360 ms post-drag click suppression, real touch swipe (left/right snap, vertical gesture ignored, `touchcancel`), neighbour tap → centre → second tap open, 44 px controls, 12 px labels, 13 px description, no horizontal overflow, the 3×2 Content grid, directional panel changes with fixed header/tab bar, counts/search/year filters/empty-state reset, 20 → 40 posts, Value Stack and lecture grouping, one-link project rows with external cues and lazy images, mailto without `target`, and reduced motion (no panel animation, no menu transition, drag disabled). The only console errors are the pre-existing Umami endpoint 400s. Semantics were checked in the DOM/accessibility tree; a physical VoiceOver/TalkBack and iPhone pass remains outside this environment.

## Reader phase — design-review items 26–30

- **26 — Done.** The essay body is now parsed as a small Markdown subset (`components/EssayBody.tsx`) into semantic `h2`/`h3` with ids and anchor links, lists, blockquotes, rules, inline code, links, and figure captions; prose is Jost at 17 px mobile / 18 px desktop, 1.66 line-height, 65 ch measure, with persistent underlines and mono reserved for dates, read time, captions, and metadata.
- **27 — Done.** A persistent reader bar carries the title, date, read time, canonical “Copy link” action, and a thin progress line; long essays get a floating “Contents” disclosure (six minutes or more) that never resizes the reading area, and the foot offers newer/older essay cards. Return to List keeps the list scroll and card focus, and copy/return status is announced politely.
- **28 — Done.** Every essay gets its own title, description, canonical, OG/Twitter tags, `article:published_time`, and `Article` JSON-LD, plus a generated static shell at `/content/essays/<slug>/` containing the H1 and excerpt for crawlers. Build-time `sitemap.xml` and `robots.txt` cover all routes, and the existing portrait serves as the share image.
- **29 — Done.** Type moves onto the 12 / 14 / 16 / 20 / 28 / 36 px scale with 300–400 weights, 0.14–0.2 em uppercase tracking, tabular numerals for the clock and dates, no serif book title, mono limited to metadata/keycaps, and glow limited to the selected menu item and screen title.
- **30 — Done.** Semantic colour tokens (`--bg`, `--panel`, `--text`, `--text-secondary`, `--text-muted`, `--accent`, `--accent-soft`, `--success`, `--danger`, `--warning`) replace the ad-hoc palette; all measured text pairs now clear 4.5:1, the CRT overlay is a 3.3 % average monochrome layer behind content and is off for coarse pointers/reduced motion, the RGB split and purple are gone, and blue/cyan carry the interface with one amber warning.

### Bug-scan fixes

- **CT-04** — Re-verified the five measured pairs: inactive Content and Portfolio tabs and the footer helper use `--text-secondary` (13.65:1), Work location uses `--text-muted` (9.26:1), and the book subtitle uses blue-200/85 (10.16:1); also raised the non-active menu label opacity floor from 0.4 to 0.6 so carousel labels stay above 4.5:1.
- **PF-04** — Reader prose is no longer 14 px mono: it uses the self-hosted Jost display face at 17/18 px with mono reserved for metadata, and the type pass removed the remaining bold/wide-tracking dashboard treatment from the essay, book, and reader chrome.

### Verification

`npx tsc --noEmit -p .` and `npm run build` pass (main 329.31 kB / 105.66 kB gzip, content 58.22 kB / 16.53 kB gzip, CSS 48.51 kB / 10.63 kB gzip). Production preview at 1440×900 keyboard/mouse and 390×664 touch/DPR 3: reader title/meta/canonical/OG/JSON-LD, five real H2s, 65 ch desktop measure and 340 px mobile prose, progress 0→1, responsive contents disclosure with Escape closing the list rather than the reader, copy-link clipboard and live confirmation, newer/older navigation resetting scroll and focusing the title, heading permalinks after reload, Return to List restoring list scroll/card focus, error state plus successful retry, reduced-motion CRT/transition suppression, zero horizontal overflow, and no page errors or console warnings. All 15 essay shells, the 29-URL sitemap, robots.txt, and trailing-slash canonical/copy URLs were checked; direct no-slash essay entries normalize to the static-shell slash. The recurring Umami endpoint 400 is the pre-existing MS-01 analytics issue and is outside this phase. GitHub Pages deployment was not run because this phase is prohibited from using git.
