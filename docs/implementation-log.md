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
