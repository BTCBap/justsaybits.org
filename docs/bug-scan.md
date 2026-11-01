# Bug scan: justsaybits.org

Review-only audit of the production build at `http://localhost:4401/` (source: `App.tsx`, `index.html`, `components/*`, `utils/*`, `data/*`) and the built bundle in `dist/`. Checked at **1440 × 900 (keyboard + mouse)** and **390 × 664 / iPhone 13 emulation (touch, DPR 3)**, plus a reduced-motion context. Measurements come from read-only headless Chrome checks, the DOM/CSSOM, console output, and the source. No image file was opened.

This is a personal site, so "bug" includes broken expectations that a visitor will hit, not only crashes. The brief's emphasis is on the sound and haptics system, so that section is first and most detailed.

## Severity summary

| Severity | Count | Meaning |
|---|---:|---|
| High | 13 | Blocks or corrupts a core flow, breaks sound/haptics for a whole platform, or fails WCAG at the task level. |
| Medium | 20 | Noticeable degradation, inconsistent feedback, or an accessibility/perf problem users will encounter. |
| Low | 5 | Polish, edge cases, or code hygiene with a visible cost. |
| **Total** | **38** | |

Legend: **Verified** means reproduced in headless Chrome or measured from the build. **Code-read** means the path is clear from source but was not reproduced on the exact device (notably iOS).

---

## 1. Sound and haptics

### HB-01 · High · Boot audio is scheduled while the AudioContext is suspended, then plays ~7 s late — **Verified**

**Where:** `components/BootSequence.tsx:12-18` → `utils/SoundManager.ts:11-24`, `utils/SoundManager.ts:105-125`.

**Repro:** Open the site in a fresh tab and click nothing. By 0.8 s one `AudioContext` exists in state `suspended`; Chrome logs “The AudioContext was not allowed to start” twice. At 7.5 s the context is still suspended. Click the menu at ~8.2 s: the context resumes at `currentTime ≈ 0.52`, and the boot oscillator (`start` at context time 0, `stop` at 7) ends at wall-clock **14.98 s**, i.e. the 6-second boot pad begins when the visitor first interacts with the menu and runs under the home screen.

**Cause:** `playBoot()` calls `init()`, which creates the context during mount, before any user gesture. The oscillator is scheduled immediately against a frozen `currentTime`. Nothing waits for `resume()` to settle.

**Fix:** Do not create or schedule audio before a gesture. Put the boot behind a one-tap “power on” gate (or a silent boot that starts audio on the first `pointerdown` and plays a short, non-time-critical sting). Await `ctx.resume()` and check `ctx.state === 'running'` before scheduling. If audio is unavailable, keep the boot visual and do not queue a late sound.

---

### HB-02 · High · `resume()` is fire-and-forget, so the first cursor/confirm/back sounds are dropped — **Verified**

**Where:** `utils/SoundManager.ts:19-28` (init resumes without awaiting), `utils/SoundManager.ts:31-52` (playHover schedules immediately), `components/App.tsx:40-53`.

**Repro:** From a fresh load, press `ArrowRight` twice at ~7.3 s. Both oscillators are created while the context reports `suspended`; the context only reaches `running` after `resume()` settles. The first interaction is inaudible or clipped; the second can arrive as a click. Only the third sound (`Enter`) is reliably scheduled while running.

**Cause:** Every `play*` calls `init()` and then schedules against `ctx.currentTime` in the same tick. The window-level resume listener in `App` also runs after React’s handler in some orderings, so sound code can run before the resume promise resolves.

**Fix:** Make a single `ensureRunning(): Promise<AudioContext>` that awaits `resume()`, then schedule. Call it from the interaction helper and `await` it (or queue the first sound to the `statechange`/`running` event). Remove the duplicate window listener in `App`; the interaction bus should own resumption.

---

### HB-03 · High · Audio is never recovered from iOS `interrupted` (backgrounding, calls, Siri, lock) — **Verified code path; platform behaviour**

**Where:** `utils/SoundManager.ts:20-23`; `components/App.tsx:40-53`.

**Repro:** On iOS Safari, start audio, background the tab or take a call, return, then move the cursor. The context state becomes `interrupted` (WebKit). `init()` only checks for `suspended`, so it does nothing. The one-shot `click`/`keydown` listener in `App` removed itself after the first interaction, so nothing retries.

**Cause:** Incomplete state handling and a self-removing resume listener. There is also no `visibilitychange`, `pageshow`, or `statechange` recovery.

**Fix:** Handle `suspended`, `interrupted`, and `closed`; re-create a closed context. Subscribe to `statechange`; on `visibilitychange`/`pageshow` mark audio as needing a resume and resume on the next gesture. Do not remove the recovery listener until the context has actually reached `running`; keep a permanent `pointerdown` fallback.

---

### HB-04 · High · There is no mute control; `isMuted` is dead code and nothing persists — **Verified**

**Where:** `utils/SoundManager.ts:4` (`private isMuted`), no setter anywhere; `components/MainMenu.tsx:338-374` has no sound control; `components/ContentScreen.tsx:925-935` has only Back.

**Repro:** Every visit plays sounds at startup with no way to silence them. There is no `localStorage`, `aria-pressed`, keyboard shortcut, or visible state. A visitor who dislikes the blips must mute the device or leave.

**Cause:** The flag is read in every `play*` method but never written. No settings surface exists.

**Fix:** Add a persistent sound/haptics setting pair (menu and content footer, `aria-pressed`, “Sound on/off”, `M` shortcut, `localStorage` key with a version). Default sound off until the power-on gesture, default haptics on only when `navigator.vibrate` exists *and* a coarse pointer is present. Announce changes with a polite live region. Also expose a “reduce motion” preference that follows the OS by default.

---

### HB-05 · High · Haptics fire on hover, which has no user activation, and double-fire on touch — **Verified**

**Where:** `components/ContentScreen.tsx:293-298` (media), `:323-328` (posts), `:362-367` (reading), `:389-394` (social), and click handlers at `:299`, `:329`, `:368`, `:395`; menu hover is at `components/MainMenu.tsx:214-215` (no haptic).

**Repro:** On an iPhone-emulated context, tap the first essay once. The event log shows one `click`, **two** vibration calls `[10, 20]`, and two sounds (hover + select). Tapping a social card does the same. On Android, the `onMouseEnter` haptic has no activation context, so the browser ignores it; the light tick the code intends never happens there. On desktop Chrome `navigator.vibrate` exists, so the code calls it for no effect.

**Cause:** React’s `onMouseEnter` is synthesized after a touch tap; the sequence is mouseenter → click. The hover handler plays a haptic and a sound; the click handler plays another haptic. On pointer devices the hover call is outside activation.

**Fix:** Never play haptics from `mouseenter`/hover. One haptic per activation, fired from `pointerdown` (if it is a control) or the click handler, through a single `interact({ sound, haptic })` helper. On touch, suppress the synthesized hover path (`pointerType === 'mouse'` only for hover feedback). Add a test that asserts exactly one vibration per tap.

---

### HB-06 · Medium · Haptics do not exist on iOS, and support detection overpromises — **Verified**

**Where:** `utils/HapticManager.ts:10-12`, `:20-28`.

**Repro:** iOS Safari has no `navigator.vibrate`; `isSupported` is `false` and every method returns. The site's own haptic vocabulary (light/medium/swipe) is therefore silent for every iPhone user. On Android, `vibrate(10)` is at or below the perceptual floor of several devices and can be quantized away.

**Cause:** The manager assumes the Vibration API is the only route and checks once at module construction. There is no iOS fallback and no coarse-pointer check.

**Fix:** Treat haptics as an enhancement with a documented platform matrix. On iOS 17.4+ use the hidden `<input type="checkbox" switch>` toggle inside a real click if you accept that technique, or leave iOS without haptics and do not imply otherwise. Raise the light tick to 12–15 ms, use `navigator.userActivation?.isActive` as a guard, and gate the whole manager behind the haptics setting and `prefers-reduced-motion`.

---

### HB-07 · Medium · Sound fires on a carpet of hovers and never on keyboard focus — **Verified**

**Where:** `components/ContentScreen.tsx:293-298`, `:323-328`, `:362-367`, `:389-394`, `:481`, `:509`, `:587`, `:639`, `:724-727`, `:852`; `components/MainMenu.tsx:214-215` (hover changes scale but is silent); `components/ContentScreen.tsx:760-789` (tabs change with a “move” sound on click, no focus sound).

**Repro:** On desktop, move the mouse down the Essays list at ~40 px steps. Ten oscillators and nine vibration calls are created in about one second. Tab through the same list with the keyboard: the essay cards are not focusable at all, and the one source link that is focusable makes no sound. The menu is the opposite: hovering a card is silent while arrow keys blip.

**Cause:** Audio is attached to `onMouseEnter` at card level rather than to a selection model. There is no `onFocus` counterpart and no throttling.

**Fix:** Define one cursor event: “the highlighted item changed.” Fire one soft tick per change (throttled to ~60–80 ms), whether the change came from pointer, arrow key, or focus. Reserve confirm/back for activation. Move pointer hover to the same selection state as keyboard so both modalities sound and look identical.

---

### HB-08 · Medium · Confirm and back share the same downward shape; the boot “chime” is sub-bass and very quiet — **Verified from synthesis parameters**

**Where:** `utils/SoundManager.ts:54-76` (300→100 Hz), `:79-102` (200→100 Hz), `:105-125` (60→120 Hz), master gain at `:18`, per-sound gains at `:44`, `:69`, `:91`, `:117`.

**Repro:** Trigger `playSelect()` and `playBack()` in sequence. Both are descending sines; neither has a bright transient, so “confirm” and “cancel” are hard to tell apart, and both read as a soft thud. `playBoot()` is a 60→120 Hz sine at 0.1 gain times a 0.15 master (peak ≈ 0.015), largely below the passband of phone speakers. Every sound is also quieter than typical UI feedback, so the system reads as broken on laptop speakers.

**Cause:** One oscillator per sound, no mid/high partials, no compressor, and a master chosen to avoid clipping rather than to a target loudness.

**Fix:** Composed, original voices: cursor = 30 ms high sine/triangle blip with a tiny noise transient; confirm = two-note rising interval (~660→990 Hz); back = one deeper, longer falling tone (~440→220 Hz); error = two low short pulses; boot = a quiet pad plus a glassy bell at 520/780 Hz. Add a `DynamicsCompressorNode`, cap concurrent voices, and normalize to roughly −18 to −14 LUFS short-term. Make each sound mono-safe and test with the device at 50% volume.

---

### HB-09 · Medium · No throttling or voice cap; rapid navigation stacks sounds and cancels haptics — **Code-read, partly verified**

**Where:** `utils/SoundManager.ts:31-76` (no guard), `utils/HapticManager.ts:20-28` (new `vibrate` cancels the previous pattern), `components/MainMenu.tsx:95-106` (key repeat has no `e.repeat` guard).

**Repro:** Hold `ArrowRight` on a keyboard with key repeat (or send repeated keydown events). Each event calls `goToAdjacent`, which plays a blip and `vibrate(10)`. Because a new vibration call interrupts the previous one, sustained navigation produces a stutter rather than a clean tick, and the sound layer accumulates overlapping oscillators. Haptics patterns such as `success()` would be cut off by any later light tick.

**Cause:** No debounce, no `event.repeat` check, no last-played timestamp, no cancellation policy.

**Fix:** Ignore `e.repeat`; throttle cursor ticks to ~60 ms; keep at most 3 concurrent voices; cancel a pending haptic pattern before a new intentional one, but do not let a stray hover cancel success/error. Route everything through the interaction bus.

---

### HB-10 · Medium · iOS silent switch and silent-mode users get no sound and no indication — **Code-read; platform behaviour**

**Where:** `utils/SoundManager.ts:11-24`, `:105-125`; no UI state in `components/MainMenu.tsx`.

**Repro:** On an iPhone with the ringer switch off, Web Audio is muted. The site still animates a sound-led boot and gives no visible “sound is off” cue, so the intended PS2 chime moment simply does not exist. There is no hint to check the switch and no alternative feedback.

**Cause:** Web Audio respects the silent switch; the app assumes audible output and has no muted-state UI.

**Fix:** Treat “sound available” as a three-state setting (on / muted by user / unavailable). Show a small speaker state in the menu footer, and on iOS show a one-time, dismissible hint if audio is unavailable. Use the mute setting as the visible source of truth; do not try to detect the switch by playing a probe.

---

## 2. Boot and first paint

### BT-01 · High · The boot blocks interaction for 7.2 s and drives LCP to 6.7 s — **Verified**

**Where:** `components/BootSequence.tsx:20-25` (4 s + 1.5 s + parent exit), `components/App.tsx:61-68` (1 s exit).

**Repro:** Navigate to `/` and poll the centre of the viewport. The boot wrapper is removed and the menu becomes clickable at **7,176 ms** after navigation start. LCP is reported at **6,680 ms** (“PRESS ENTER”); FCP is 572 ms. During the first 5.5 s the boot container is a fixed, full-screen layer over the app; at ~5.5 s the intro is gone but the container stays for another 1 s of black, then the parent fades it over the menu.

**Cause:** A fixed 4 s timer, a 1.5 s nested timer, a 1 s `AnimatePresence` exit, and no skip path. `AnimatePresence mode="wait"` also delays the menu reveal.

**Fix:** Target 1.4–1.8 s total. Crossfade the boot into the menu rather than fading to black and back. Add “Press any key / tap to skip” from 300 ms, and remember a returning visitor (session storage) so the full sequence is once per session. Re-measure LCP; the menu content should be the LCP element under 2.5 s.

---

### BT-02 · Medium · Two and a half seconds of the boot are visually empty black — **Verified timing**

**Where:** `components/BootSequence.tsx:19-25` (fadeout with no content after 1.5 s), `components/App.tsx:61-68`.

**Repro:** Watch the sequence with the network throttled. At 4 s the towers/clouds fade out; the screen is pure black from 4 s to 5.5 s (the `stage === 'fadeout'` branch renders nothing), then the boot layer fades to black over the menu for another 1 s. Nothing communicates progress or that the system is alive.

**Cause:** The exit is modelled as “remove the content, hold black, then unmount.”

**Fix:** The exit should be a transformation: hold the last tower/light frame, dim it, and let the menu emerge in the same blue field. Keep a small persistent mark or progress line if any wait remains. No full-black hold longer than ~200 ms.

---

### BT-03 · Medium · The tower scene re-randomizes on render and uses 25 blurred elements; the fadeout produces 50–60 ms long tasks — **Verified / code-read**

**Where:** `components/BootSequence.tsx:45-49` (random height/width/x/delay/scale), `:51-80` (25 motion divs with `filter: blur(...)`), `:84-94` (two large blurred clouds).

**Repro:** In headless Chrome, `PerformanceObserver` for `longtask` shows tasks of 51–62 ms repeatedly between 4.1 s and 4.8 s, exactly during the intro exit, and another 59 ms task at 6.3 s. The random values are computed during render, so a re-render (including the stage change and React StrictMode in development) draws a different field, which can pop.

**Cause:** Unstable render inputs and expensive, large blur filters on many composited layers; no `useMemo`, no seeded randomness.

**Fix:** Seed the scene from a constant or a per-session seed in `useMemo`; render it once. Replace per-element `blur()` with a pre-blurred gradient/texture or a single canvas layer. Use `transform`/`opacity` only, reduce to ~10–14 towers on phones, and drop the two 600 px blurred divs to one radial gradient. Measure long tasks again.

---

### BT-04 · High · `prefers-reduced-motion` is ignored everywhere, including the 7 s boot and the full-screen background — **Verified**

**Where:** `components/BootSequence.tsx` (no media query), `components/PS2Background.tsx:47-157` (always animates), `components/MainMenu.tsx:200-285` (springs, infinite rotate), `components/ContentScreen.tsx:41-53`, `components/App.tsx:84-98`.

**Repro:** Emulate `prefers-reduced-motion: reduce` and reload. The boot still runs 7 s; the main menu still springs, scales, and rotates its active ring; the canvas still calls `requestAnimationFrame` at ~60/s; content screens still scale and blur on entry/exit.

**Cause:** No `useReducedMotion`/`matchMedia` checks anywhere; Framer Motion does not opt in automatically.

**Fix:** A single motion policy hook: reduced motion means no boot flight (static poster frame + short fade), no scale/blur transitions (opacity only, ≤120 ms), no infinite rotations, no parallax or bobbing canvas (static gradient or very slow opacity pulse), and no haptics. Keep the poster frame informative: show the menu with the active item, clock, and helper bar immediately.

---

## 3. Navigation and state

### NV-01 · High · There is no URL or history state; browser Back leaves the site — **Verified**

**Where:** `components/App.tsx:21-28` (state only), `:30-37` (analytics only), `components/ContentScreen.tsx:249-257` (`onBack` internal), `index.html:7` (static title).

**Repro:** Visit a prior page, then the site, open Content, then press the browser Back button. The browser returns to the prior page; the site does not return to the menu. Refresh while reading an essay and you land on the boot/menu again. The URL stays `/`, and `document.title` stays `justsaybits.org` on every screen.

**Cause:** Navigation is local React state with no `pushState`/`popstate` and no route model.

**Fix:** Add real routes (`/`, `/about`, `/content/essays`, `/content/essays/:slug`, etc.) with history integration, or at minimum a hash router and `popstate` handling. Set `document.title` and a per-route meta description/canonical. On GitHub Pages generate `404.html` as an SPA fallback if using path routes. This also makes essays linkable and indexable.

---

### NV-02 · High · Pressing Enter on a focused button opens a section — **Verified**

**Where:** `components/MainMenu.tsx:95-106`.

**Repro:** Tab to the “Previous section” button, press Enter. The page opens About instead of only moving the carousel. The window-level `keydown` handler sees Enter, plays select, and calls `onSelect(sections[activeIndex].id)` while the button’s native click also fires.

**Cause:** A global Enter shortcut with no `event.target` guard and no `defaultPrevented`/`repeat` check.

**Fix:** Ignore Enter when the event target is an interactive element (`button`, `a`, `input`, `[role=button]`) or when `e.defaultPrevented`; scope the shortcut to the carousel container with `tabIndex=0` and a `role`/instruction, or handle Enter on each option. Add a test for “Enter on Prev does not navigate.”

---

### NV-03 · Medium · Global Backspace navigates back and competes with the browser; Escape does nothing — **Verified**

**Where:** `components/ContentScreen.tsx:259-267`.

**Repro:** Open an essay, focus a link inside it, press Backspace. The app returns to the essay list. With focus in a text selection or a future input, the same shortcut would still fire. Escape, the expected “close” key, is not handled anywhere.

**Cause:** A raw `window` keydown for Backspace with no target check and no `preventDefault`; no Escape handler.

**Fix:** Use Escape to close the reader/dialog and restore focus. Keep explicit Back/Close controls. If Backspace is kept, require no interactive target and no modifier, and `preventDefault()` only when you act. Document the shortcut in the help bar.

---

### NV-04 · Medium · Content screens are not dialogs: no `role`, no focus move, no trap, no restore — **Verified**

**Where:** `components/ContentScreen.tsx:897-908` (outer div), `:909-918` (header), `:925-935` (footer).

**Repro:** Open About from the menu. `document.activeElement` remains `BODY`. Tab starts at the first focusable element inside the overlay, but there is no accessible name for the overlay, no `aria-modal`, no Escape, and on close focus is lost to the document rather than returned to the section card. A screen reader has no announcement that the screen changed.

**Cause:** A visually modal fixed panel implemented as a plain `div`.

**Fix:** Use `role="dialog" aria-modal="true" aria-labelledby="screen-title"`, move focus to the title or Back button on open, trap Tab within the panel, restore focus to the invoking item on close, and handle Escape. Add a visually hidden H1 and a polite live region for the title change. If this is conceptually a page rather than a dialog, use a route and focus management instead.

---

### NV-05 · Medium · Returning from an essay loses the reader’s place in the list — **Verified**

**Where:** `components/ContentScreen.tsx:236-238`.

**Repro:** Scroll halfway down 15 essays, open one, press Back. The list scrolls to the top; the opened card is not focused or highlighted, so the reader has to find it again.

**Cause:** The effect scrolls the body to 0 on every `selectedEssay`, `contentTab`, and `section.id` change, with no saved position.

**Fix:** Save the scroll offset and the selected card id before opening; restore both on return, focus the card, and announce “returned to Essays.” Keep the tab bar and header fixed (already true) so the context is visible. This is direct Family Values “preserve context.”

---

## 4. Main menu

### MN-01 · High · The six menu items are non-semantic divs; only four buttons exist in the accessibility tree — **Verified**

**Where:** `components/MainMenu.tsx:200-223` (motion div with `onClick`, no `role`, `tabIndex`, or key handler), `:148-152`; `constants.tsx:191-198` (`description`, `color` never rendered).

**Repro:** Load the menu and list focusables: only the two 56 px arrows and the two 20 px footer arrows. The six section cards cannot be reached by Tab, have no accessible name beyond their heading text, and expose no selected state. The `description` values (“Mission & Values”, “Career History”, …) are dead data. The screen-reader experience is “Previous section, Next section” with no list of destinations.

**Cause:** Pointer-only interactive divs and a global keyboard shortcut standing in for semantics.

**Fix:** Model the carousel as a listbox or tablist: each item is an option/tab with `aria-selected`, a roving `tabIndex`, arrow-key navigation, Enter/Space to open, and the selected description in an `aria-live` region or a labelled detail panel. Add a visible focus ring that matches the active glow. Render the description in the composition.

---

### MN-02 · Medium · Mobile controls are 20 px, the hint says “Press Enter”, and the helper text shrinks to ~7.5 px — **Verified**

**Where:** `components/MainMenu.tsx:291-328` (arrows `hidden md:flex`), `:352-367` (20×20 footer buttons), `:273-280` (“Press Enter”), `:338-374` (footer).

**Repro:** At 390 px the two main arrows are hidden; the only visible controls are the two 20×20 buttons in the footer. The active card says “Press Enter” even though there is no Enter key. The hint is `text-[10px]` inside a carousel scaled 0.75, so its effective size is ~7.5 px. Touch targets fail WCAG 2.5.8 (24×24 minimum) and are far below the 44 px iOS guidance.

**Cause:** Desktop-only controls and desktop-only copy in a responsive component; scale applied to a whole subtree including text.

**Fix:** On coarse pointers show a 44 px previous/next affordance or edge zones, and change the hint to “Tap to open · Swipe to browse.” Keep the helper bar at a real 12–14 px after scaling. Make the footer arrows honest controls with 44 px hit areas, or remove them and rely on swipe plus visible dots.

---

### MN-03 · Low · The 3D carousel has no perspective, hover does not move selection, and a click opens immediately — **Verified / code-read**

**Where:** `components/MainMenu.tsx:171` (`perspective-1000` is not a Tailwind 3 utility and is absent from the generated CSS), `:190-192` (`rotateY`), `:214-215` (hover only scales), `:148-152` (click sets index and opens in the same event).

**Repro:** The neighbours are flattened horizontally rather than receding in depth (no `perspective` rule exists in the stylesheet). Hovering a neighbour grows it but leaves the active item and the “Press Enter” label where they were; clicking a peeking neighbour opens it without ever previewing it. Pointer and keyboard therefore teach different models.

**Cause:** A utility that does not exist in the CDN build, plus a hover model that is purely decorative.

**Fix:** Add a real `perspective: 1000px` on the stage. Make pointer hover move the active selection (one cursor tick), with click/Enter confirming the already-highlighted item. If a one-click open is desired, remove the two-step “Press Enter” affordance so the model is consistent.

---

## 5. Content screens and tabs

### CT-01 · High · Essay cards cannot be opened by keyboard — **Verified**

**Where:** `components/ContentScreen.tsx:719-735` (`<article onClick>` with no `tabIndex`, `role`, or key handler).

**Repro:** Open Content → Essays, then Tab through. The 15 articles are all `tabIndex=-1`; only one “Published on bitcoinmagazine.com” link inside one card is focusable. A keyboard-only reader cannot open any essay. The same pattern affects the essay list's discoverability for screen readers: the cards are articles, not links.

**Cause:** Click handlers on non-interactive containers.

**Fix:** Make each card a single `<a>` (or button) with the title as the accessible name, or add `role="link"`, `tabIndex=0`, and Enter/Space handlers plus a focus style. Put secondary “source” links outside the primary link. Add the permalink here when routing exists.

---

### CT-02 · Medium · The tab bar declares `role=tab` but breaks the tab pattern, and hides two tabs off-screen on mobile — **Verified**

**Where:** `components/ContentScreen.tsx:760-789`.

**Repro:** At 390 px the tab strip is 641 px wide inside a 356 px viewport; “TUTORIALS” is cut and “READING” starts at x=541, entirely off-screen. All six tabs have `tabIndex=0` (no roving), ArrowRight does nothing, there are no `aria-controls`/`id` links, and there is no `role=tabpanel`. Clicking a tab calls `scrollIntoView({behavior:'smooth'})` unconditionally, which also ignores reduced motion.

**Cause:** Partial ARIA without behaviour; a horizontally scrolling strip with hidden overflow and no affordance.

**Fix:** Implement the WAI-ARIA APG Tabs pattern (roving tabindex, Left/Right/Home/End, `aria-controls`, `role=tabpanel`, `aria-labelledby`, focus follows selection or a manual variant). On phones use a two-row segmented control or add edge fades plus chevrons and a scroll snap; never hide the last tab with no cue. Respect reduced motion for `scrollIntoView`.

---

### CT-03 · Medium · Every project card has two links to the same URL, and the overlay covers the icon link — **Verified**

**Where:** `components/ContentScreen.tsx:591-596` (icon anchor inside the title) and `:611-613` (absolute inset-0 anchor over the card).

**Repro:** Tab through Portfolio → Projects. Each card produces two stops: the tiny icon link and “View Bitcoin Birth Certificate”. The inset overlay has `z-10`, so the icon link cannot be clicked with a pointer; its focus outline may be clipped at the card edge. Screen readers announce the same destination twice.

**Cause:** Two competing link implementations for one card.

**Fix:** Use one anchor wrapping the whole card with `aria-label` or a heading link plus a stretched-link pseudo-element. Make the external-link icon decorative (`aria-hidden`), and add “opens in a new tab” as visually hidden text. Keep one Tab stop per card.

---

### CT-04 · Medium · Multiple text/background pairs fail WCAG contrast — **Measured**

**Where:** `components/MainMenu.tsx:345` (helper `text-blue-400/60`), `components/ContentScreen.tsx:780` (inactive content tab `text-blue-400/70`), `:542-566` (inactive portfolio tab `text-blue-500/50`), `:875` (location `text-blue-600`), `:660` (book subtitle `text-white/40`).

**Repro (computed against `#050a14`):** helper text **3.42:1**, inactive content tabs **4.26:1**, inactive portfolio tabs **2.15:1**, location **3.83:1**, book subtitle **3.76:1**. All are below the 4.5:1 required for normal text; the helper and tabs are small uppercase, which makes it worse.

**Cause:** Opacity-based Tailwind colour variants used for secondary text without checking the composited result.

**Fix:** Define semantic tokens (`--text-primary`, `--text-secondary`, `--text-muted`, `--accent`) with measured ratios, and use at least 4.5:1 for body and 3:1 for large text. Replace `blue-500/50` with an opaque blue around `#7aa7e8`. Keep the glow as a separate shadow that does not lower contrast.

---

### CT-05 · Medium · Footer and Book targets are below the minimum touch size — **Verified**

**Where:** `components/ContentScreen.tsx:926-933` (Back to Home button, no padding), `:670-677` (Get the Book), `components/MainMenu.tsx:352-367` (20 px arrows).

**Repro:** On iPhone emulation the “BACK TO HOME” button is **16 px tall** and 125 px wide; “Get the Book” is 38 px tall; footer arrows are 20×20. WCAG 2.5.8 requires at least 24×24, and Apple/Material recommend 44/48.

**Cause:** Buttons size to their inline content; the footer relies on visual spacing rather than hit-area padding.

**Fix:** Give buttons `min-height: 44px` and horizontal padding; expand the footer button to the full row; use a 44 px icon button for arrows. Keep the visual text small if desired while increasing the hit area.

---

### CT-06 · Medium · Portfolio sub-tabs are plain buttons with no roles and only a colour change — **Verified**

**Where:** `components/ContentScreen.tsx:532-568`.

**Repro:** The three tabs are `<button>`s with no `role=tab`, no `aria-selected`, no panel association, and all `tabIndex=0`. The inactive state is a 2.15:1 blue; selection is conveyed by colour plus a 2 px underline only. Keyboard users tab through all three but get no announcement of the selected panel.

**Cause:** A second tab implementation that drifted from the Content tabs.

**Fix:** Reuse one accessible `Tabs` component for both Content and Portfolio; add `role=tablist`/`tab`/`tabpanel`, `aria-selected`, roving focus, and a high-contrast selected treatment (icon + text + underline + background tint). Assert contrast.

---

### CT-07 · Low · Social/email links open a blank tab, and external affordances are hover-only — **Verified**

**Where:** `components/ContentScreen.tsx:387-395` (`target="_blank"` on the `mailto:` link), `:307-309` / `:349` / `:376` (external icon opacity 0 until hover).

**Repro:** Tapping Email opens an empty new tab before handing off to the mail client; on touch, the external-link icon never appears because there is no hover. Links that leave the site have no persistent cue.

**Cause:** One link component for web, mail, and external destinations; hover-only styling.

**Fix:** Render `mailto:` without `target`, with a copy-email action. Add a persistent small external glyph (not hover-only) plus visually hidden “opens in a new tab”. For LinkedIn/X, show the platform mark or a short domain.

---

### CT-08 · Medium · The Book cover is a 2048² 588 KB JPEG with no dimensions and no lazy loading — **Verified**

**Where:** `constants.tsx:119` (`coverImage: "/bitcoin-tao-cover.jpeg"`), `components/ContentScreen.tsx:645-649`, `:12-16` (imports).

**Repro:** Opening Book downloads 587,783 bytes for an image displayed at 192×288 CSS px (576×864 device px at DPR 3). The tag omits `width`/`height` and `loading`; the fixed container avoids CLS today, but the bytes are 5–10× what the rendition needs.

**Cause:** An unoptimised source dropped into `public/` and used directly.

**Fix:** Export a 640×960 (and 320×480) WebP/AVIF at ~40–60 KB, add `width`/`height`, `loading="lazy"`, `decoding="async"`, and a low-quality placeholder. Keep the square-crop composition intentional rather than object-cover cropping a square into 2:3.

---

## 6. Performance, loading, and runtime

### PF-01 · High · Tailwind is loaded from the Play CDN and compiles CSS at runtime — **Verified**

**Where:** `index.html:33`.

**Repro:** The network panel shows a **407,279-byte** third-party script before any app code; the console warns “cdn.tailwindcss.com should not be used in production.” The page renders un-styled until the script runs, and every DOM change triggers style generation. This is the single largest transfer on the page after the app bundle.

**Cause:** A development-only Tailwind build left in the production head.

**Fix:** Compile Tailwind at build time (Tailwind CLI/PostCSS/v4 Vite plugin) and ship a hashed stylesheet, or replace utilities with the small set of hand-written CSS this site actually needs. Remove the CDN script. Re-check FCP/LCP and the console.

---

### PF-02 · High · One 461 KB JS chunk carries the menu, every screen, and all essay/media data — **Verified**

**Where:** `dist/assets/index-*.js` (461,542 B; 150,169 B gzip); static imports at `components/ContentScreen.tsx:17-31`; `data/essays.ts` (67 KB source), `data/posts.ts`, `data/media.ts`.

**Repro:** The entire app, including all 15 essays' full text and all media metadata, is in the initial chunk. The menu needs none of it; Content may need one tab; the reader needs one essay. There is no dynamic import, `Suspense`, or route split.

**Cause:** Barrel imports from `constants.tsx` re-export all data into `ContentScreen`, which is statically imported by `App`.

**Fix:** `React.lazy` the ContentScreen and split per section/tab; import essays on demand by slug (or fetch JSON). Keep the menu path under ~120 KB gzip. Replace `framer-motion`'s full import with `LazyMotion`/`m` for simple fades, or use CSS transitions; audit `lucide-react` imports (only a handful are used). Measure with `rollup-plugin-visualizer`.

---

### PF-03 · Medium · The background canvas is 1× on HiDPI, never cancels its RAF, and runs under every screen — **Verified / code-read**

**Where:** `components/PS2Background.tsx:15-19` (backend size = CSS px), `:47-157` (60 fps loop), `:155` (`requestAnimationFrame(draw)`), `:162-164` (cleanup removes only the resize listener), `:24-34` / `:77` / `:113-115` (50 towers, per-frame sort, `shadowBlur`).

**Repro:** At DPR 3 / 390 CSS px the canvas backing store is 390×664, so the fog and towers are visibly soft (1 device pixel stretched to 3). `canvas.width` never follows `devicePixelRatio`. On unmount/HMR no `cancelAnimationFrame` is stored, so the loop leaks; in development StrictMode the effect mounts twice, leaving two loops. The loop also runs while a Content screen covers it with `backdrop-blur-md`.

**Cause:** No DPR scaling, no rAF handle, no visibility/route pause, and an expensive per-frame path (sort + gradient + shadow blur) for a decorative layer.

**Fix:** Size the backing store to `min(dpr, 2)`, use `ctx.setTransform`, cache the radial gradient and sorted tower list, drop `shadowBlur` for a sprite, run at 30 fps or pause when `document.hidden` or a screen is open, and cancel the RAF in cleanup. Provide a static CSS fallback under reduced motion.

---

### PF-04 · Medium · Google Fonts is a render-blocking third party, and the typefaces fight the PS2 brief — **Verified**

**Where:** `index.html:34`; typography across `components/*`.

**Repro:** The stylesheet request is 12,385 bytes and blocks first paint; five weights (Inter 300/400/600, JetBrains Mono 400/700) are requested. The menu uses Inter **bold** at 20 px with 0.2em tracking and a heavy text-shadow; the essay reader uses JetBrains Mono at 14 px. PS2 system type is a thin, wide, geometric sans; mono is for metadata, not prose.

**Cause:** Default web-app font choices rather than a PS2-derived type system; third-party hosting.

**Fix:** Self-host one variable display face with a Futura/Jost-like geometry (weight 200–400) and one mono for labels, subset to Latin, preload the two woff2 files, `font-display: swap`, and remove the Google CSS. Use the display face for prose at 16–18 px and the mono only for dates, counts, and keycaps.

---

### PF-05 · Medium · Forty remote post images load eagerly, and image renditions are oversized — **Verified / code-read**

**Where:** `components/ContentScreen.tsx:336-345` (post `<img>` has no `loading`, `width`, or `height`), `data/posts.ts` (40 entries with `pbs.twimg.com` images), `components/ContentScreen.tsx:504-530` (design grid renders 130 px images with intrinsic 400–720 px), `public/essays/*` (up to 175 KB each).

**Repro:** Switch to Posts: all 40 remote images begin loading at once with no dimensions, so the column grows as they arrive. The X CDN may block hotlinking or throttle; the essay images are fixed at full width with no `srcset`/dimensions.

**Fix:** Add `loading="lazy"`, `decoding="async"`, explicit aspect-ratio boxes for post images, and a “load more” or virtualised list (20 at a time). Serve `srcset`/WebP/AVIF for essays and design logos, and cache remote images locally if X blocks them.

---

## 7. Console, analytics, links, and assets

### MS-01 · Medium · Every analytics beacon fails with HTTP 400 “Website not found” — **Verified**

**Where:** `index.html:35` (`data-auto-track="false"`), `components/App.tsx:30-37`, `components/ContentScreen.tsx:239-247`.

**Repro:** Load any screen. The console shows `POST https://gateway.umami.is/api/send 400` and the response body `{"error":{"message":"Website not found.","code":"bad-request","status":400}}`. The payload includes `"type":"event"` and the configured website id; no pageviews or custom events are recorded. The pageview calls use the callback form `umami.track(props => ({ ...props, url, title }))`.

**Cause:** Two likely contributors: `data-auto-track="false"` disables tracker initialisation (the docs describe `data-auto-pageview="false"` for manual pageviews), and the website id/domain pair is rejected by the collector.

**Fix:** Use `data-auto-pageview="false"` and keep automatic initialisation; verify the website id against the Umami dashboard and allow `justsaybits.org`/localhost as needed. Send explicit pageviews with `umami.track({ url, title })` or a named event; test in the network panel and remove the console error. If analytics is not wanted, remove the script so it stops costing a request and an error.

---

### MS-02 · Low · Duplicate SVG filter/gradient IDs and a dead import map — **Verified**

**Where:** `components/Icons.tsx:8-15` (every icon renders `<filter id="glow">`), `:47` (`id="discGradient"`); `index.html:71-82` (import map to `aistudiocdn.com`).

**Repro:** The menu renders six icons, so the document contains six elements with `id="glow"` and multiple `discGradient` definitions. `url(#glow)` resolves to the first matching id in the document; the rest are invalid duplicates and may resolve unpredictably across browsers. The import map is unused by the bundled app and points at a third-party CDN; a future bare import would silently load a second copy of React.

**Cause:** Per-instance `<defs>` with global ids, and leftover AI Studio scaffolding.

**Fix:** Define one shared `<svg>` sprite/defs block once with unique ids, or give each instance an id via `useId()`. Remove the import map entirely. Keep `public/` free of unused CDN assumptions.

---

### MS-03 · Low · No 404, no empty/loading/error states, and a dead-end “Under Construction” default — **Code-read**

**Where:** `components/ContentScreen.tsx:894` (`default: <div>Under Construction</div>`), `:719-735` / `:799-841` (lists render empty without a message), `public/` (no `404.html`, no `robots.txt`, no `sitemap.xml`).

**Repro:** An unknown section id (or a future data gap) renders an unstyled “Under Construction”; an empty list renders a blank panel; a GitHub Pages 404 shows GitHub's page; a slow image shows a blank box. There is no offline state and no skeleton.

**Fix:** Add a designed empty state, image skeletons with the final aspect ratio, an error boundary with retry, and a branded 404 route/page. Generate `robots.txt` and `sitemap.xml` from the routes/essays once routing exists, and add a `404.html` fallback for GitHub Pages.

---

## 8. Confirmed clean or unverified

- **No broken local assets found.** All 21 essay image paths referenced in `data/essays.ts` exist under `public/essays/`; all design logos, the portrait, the cover, favicons, manifest icons, and OG image exist. `public/CNAME` is `justsaybits.org`.
- **No confirmed broken external links.** 129/143 checked URLs returned 200; YouTube returned 429 (rate limiting), LinkedIn blocks bots with 405/404 depending on method, and `bitcoinmagazine.com` returned 403 to the checker. Re-check those by hand rather than treating them as dead.
- **No initial layout shift.** `PerformanceObserver` reported CLS 0 for the boot/menu path. Reader images without dimensions remain a CLS risk once a route is opened.
- **StrictMode double-play was not reproduced** because the dev server check was cancelled. The code path is clear: `playBoot()` in a mount effect runs twice in development, and `PS2Background` starts two RAF loops because cleanup does not cancel the first. Treat as a development-only bug until measured.
- **iOS-specific behaviour (silent switch, `interrupted`, no `vibrate`) was reasoned from platform behaviour and the code**, not run on an iPhone; validate on device before shipping the fix.

---

## Status

Current status of every ID against the `feat/ps2-design-pass` production build (1 November 2026). **Fixed** means the described cause is gone, or the review's own fallback was applied; commit areas name where the change lives. Verification for this pass is recorded in `docs/implementation-log.md`.

| ID | Title | Status | Commit area |
|---|---|---|---|
| HB-01 | Boot audio scheduled while the AudioContext is suspended | Fixed — gate waits for a gesture; no context is created before it | Audio/boot — 52ccc15, 8181e0c |
| HB-02 | `resume()` is fire-and-forget; first sounds are dropped | Fixed — `ensureRunning()` is awaited; only the newest pending event fires | Audio — 8181e0c, 52ccc15 |
| HB-03 | Audio is never recovered from iOS `interrupted` | Fixed — `closed`/`interrupted` handling, `statechange`, `visibilitychange`, `pageshow`, permanent listeners | Audio — 8181e0c, 52ccc15 |
| HB-04 | No mute control and no persistence | Fixed — settings group, `M` shortcut, `localStorage` v1, `aria-pressed`, live announcements | Audio/settings — 8181e0c, 0c8ebae |
| HB-05 | Haptics fire on hover and double-fire on touch | Fixed — haptics only from the interaction bus; hover is mouse-only and haptic-free; one vibration per tap | Audio/haptics — 8181e0c |
| HB-06 | Haptics do not exist on iOS and support detection overpromises | Fixed — coarse-pointer + `canVibrate` gate, 14 ms tick, user-activation guard; iOS reports N/A honestly | Haptics — 8181e0c |
| HB-07 | Sound on a carpet of hovers, silent on keyboard focus | Fixed — one cursor event per selection, 80 ms throttle, 800 ms dedupe, focus and hover both sound | Audio — 8181e0c, 04a7e84 |
| HB-08 | Confirm/back share one downward shape; boot is sub-bass | Fixed — rising two-note confirm, falling back, low error, glassy 520/780 Hz boot pad, compressor | Audio — 8181e0c |
| HB-09 | No throttling or voice cap; key repeat stacks sounds | Fixed — `event.repeat` guards, 80 ms cursor throttle, three-voice cap, haptic cancel policy | Audio — 8181e0c, 52ccc15 |
| HB-10 | iOS silent switch gives no indication | Fixed — Sound ON/OFF/N/A state plus one-time iOS Ring/Silent hint; no probe tone | Settings — 8181e0c, 0c8ebae |
| BT-01 | Boot blocks interaction for 7.2 s | Fixed — 1.7 s budget, power-on gate, skip, once-per-session; measured 1.9 s after the gesture | Boot — 52ccc15 |
| BT-02 | Two and a half seconds of empty black | Fixed — the scene dims and crossfades into the menu; no black hold | Boot — 52ccc15 |
| BT-03 | Tower scene re-randomizes and is expensive | Fixed — seeded `useMemo` field, fewer mobile towers, no per-element blur | Boot — 52ccc15 |
| BT-04 | `prefers-reduced-motion` is ignored | Fixed — one motion policy across boot, menu, canvas, screens and haptics | Boot/motion — 52ccc15, bd22653, c8d7fbb |
| NV-01 | No URL or history state; Back leaves the site | Fixed — History-API router, per-route titles, 404 fallback, static essay shells | Nav — 1f94203, a7781d0 |
| NV-02 | Enter on a focused button opens a section | Fixed — global Enter removed; Enter/Space belong to the focused option | Nav/menu — 1f94203, 04a7e84 |
| NV-03 | Global Backspace navigates; Escape does nothing | Fixed — Backspace binding removed; Escape closes the reader, screen and 404 | Nav — 1f94203 |
| NV-04 | Content screens are not dialogs | Fixed — `role="dialog"`, `aria-modal`, labelled title, focus move, Tab trap, restore | Nav — 1f94203 |
| NV-05 | Returning from an essay loses the reader's place | Fixed — list scroll and card id saved and focused on return | Reader — a7781d0 |
| MN-01 | Menu items are non-semantic divs | Fixed — listbox/option pattern, roving tabindex, `aria-selected`, selected panel with descriptions | Menu — 04a7e84 |
| MN-02 | Mobile controls are 20 px and the hint says "Press Enter" | Fixed — 44 px arrows and footer controls, "Tap to open · Swipe to browse", 12 px helper | Menu — 04a7e84 |
| MN-03 | Carousel has no perspective; hover does not preview | Fixed — real `perspective`, hover previews, click confirms, drag suppression | Menu — 04a7e84 |
| CT-01 | Essay cards cannot be opened by keyboard | Fixed — each card is one anchor with a focus ring | Content — 04a7e84 |
| CT-02 | Tab bar breaks the tab pattern and hides tabs | Fixed — shared `Tabs` with roving focus, roles, panel links, 3×2 mobile grid | Content — 04a7e84 |
| CT-03 | Two links per project card; overlay covers the icon | Fixed — one anchor per row, decorative external glyph | Content — 04a7e84 |
| CT-04 | Multiple text/background pairs fail contrast | Fixed — semantic tokens and measured pairs, all at or above 4.5:1 | Style — c8d7fbb |
| CT-05 | Footer and Book targets below minimum touch size | Fixed — 44 px on every footer, settings, lightbox and book action | Content — 04a7e84, 0c8ebae |
| CT-06 | Portfolio sub-tabs have no roles | Fixed — same shared `Tabs` component as Content | Content — 04a7e84 |
| CT-07 | `mailto:` opens a blank tab; external cues are hover-only | Fixed — mailto without `target`, copy action, persistent glyph and hidden text | Screens — a7781d0, f5ccea8 |
| CT-08 | Book cover is a 2048² 588 KB JPEG | Fixed — 320/640 WebP renditions, `srcSet`, dimensions, lazy decode | Content — 0c8ebae |
| PF-01 | Tailwind Play CDN compiles at runtime | Fixed — compiled PostCSS stylesheet; no CDN script | Perf — bd22653 |
| PF-02 | One 461 KB JS chunk | Fixed — lazy screens, per-tab data and per-essay chunks; 104.5 KB initial JS gzip | Perf — bd22653 |
| PF-03 | Background canvas is 1×, leaks its RAF, runs under screens | Fixed — DPR cap 2, RAF cancel, hidden/screen pause, reduced-motion static frame | Perf — bd22653, c8d7fbb |
| PF-04 | Google Fonts blocks rendering and fights the brief | Fixed — self-hosted Jost + JetBrains Mono, Latin subset, preload, `font-display: swap` | Perf — bd22653 |
| PF-05 | Forty post images load eagerly; renditions are oversized | Fixed — lazy/aspect-boxed posts, 20 at a time, srcset for essays/design/book; X images remain on their CDN rather than being rehosted | Perf/content — bd22653, 0c8ebae |
| MS-01 | Every Umami beacon returns HTTP 400 | Fixed by removal — the failing script is gone, so there is no request or console error (the review's documented fallback) | Analytics — 0c8ebae |
| MS-02 | Duplicate SVG ids and a dead import map | Fixed — `useId()` ids and no import map | Icons — 8181e0c |
| MS-03 | No 404, empty/loading/error states, robots or sitemap | Fixed — designed loading/empty/error/offline/404 states, image fallback, generated `robots.txt` and `sitemap.xml` | States — 0c8ebae, 1f94203 |

### Deferred

- **Lighthouse CI assertions for LCP/CLS/INP.** The budget is defined and the bundle/asset/robots/JSON-LD gate runs as `npm run budget`, but there is no CI provider configured in this repository. The lab measurements stay in `docs/performance-budget.md`; wiring a hosted Lighthouse job is deferred until a CI target exists.
- **iOS device validation for HB-03/HB-06/HB-10.** The code paths are implemented and the honest fallbacks are in place, but a physical iPhone pass (interrupted context, silent switch, no Vibration API) cannot run in this environment.
