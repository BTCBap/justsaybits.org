# Design review: justsaybits.org

**Role:** independent third-party UX/UI design review. I did not build this site and I have not changed any source. This document is the only design artifact.

**Scope:** every screen and state in the current build — boot, main menu, About, Social, Work, Portfolio (Projects, Investments, Design), Book, Content (Essays, Posts, Podcasts, Lectures, Tutorials, Reading, and the essay reader), the background layer, the CRT overlay, help/footer bars, all transitions, and the synthesized sound/haptic system. Audit sizes: **390 × 664 (touch, DPR 3)** and **1440 × 900 (keyboard + mouse)**, plus a `prefers-reduced-motion` context and a throttled boot observation.

**Method:** I read `App.tsx`, `index.html`, `index.tsx`, `constants.tsx`, all files in `components/` and `utils/`, the config, and the site data at a skim level; I read the Stage Show `SKILL.md` and its craft/motion/framing references, and the Family Values principles table plus the original essay. I then ran the production preview in headless Chrome for DOM, CSSOM, console, network, focus order, and event counts. No PNG/JPG/WebP was opened, so this review judges structure, behaviour, and measured styles rather than pixels.

---

## 1. Current state

### What is already good

- The site has a clear, unusual point of view. The blue fog, thin light labels, clock, scanlines, and synthesized blips read as a deliberate PS2-era system rather than a generic portfolio.
- The content is complete and personal: 15 essays with full text, a book page, work history, projects, investments, design work, podcasts, lectures, tutorials, a reading list, and 40 ranked posts.
- The responsive layout logic is more considered than most: `--app-height` follows `visualViewport`, safe-area insets are used in the menu and content shell, the carousel scales for short/landscape viewports, and the content panel is a fixed inner scroll region.
- The initial page has **no measured layout shift** (CLS 0), images that have explicit dimensions (portrait, design, book container) do not jump, and there are no broken local assets.
- The build is small in file count: one JS chunk, one HTML file, no framework router, no server. That is a good starting point for a fast site.
- The synthesized sounds are original (Web Audio oscillators), and no Sony logo, ripped audio, or trademarked boot asset is used. That constraint is being respected.

### What is holding it back

The gap is not the theme; it is the system underneath the theme.

- **The first seven seconds are the weakest part of the site.** The boot cannot be skipped, ignores reduced motion, holds a pure black frame for 1.5 s, and then fades through another second of black. Measured: the menu becomes clickable at **7,176 ms**, and LCP is **6,680 ms**.
- **The audio never reliably starts.** The boot context is created before a gesture and stays `suspended`; the boot pad is scheduled at context time 0 and actually ends at wall-clock **14.98 s**, after the visitor has already tapped the menu. The first cursor blips are scheduled before `resume()` settles. On iOS, `interrupted` is never handled. There is no mute control, no persistence, no haptic setting, and the `isMuted` flag is never written.
- **Haptics are attached to hover events**, which have no user activation on Android and do not exist on iOS; on touch, the synthesized mouseenter plus the click produces two vibrations for one tap (measured `[10, 20]`). The site also fires a sound for every card the pointer crosses (10 sounds in one pass down the essay list) while keyboard focus is silent.
- **The menu is a sci-fi carousel, not a PS2 system browser.** Six glowing orbs orbit in a flat 3D space (the `perspective-1000` class does not exist in the generated CSS), the selected item's description is dead data, and on a 390 px screen the only visible navigation controls are two 20 × 20 buttons. The hint says “Press Enter” on a phone.
- **Navigation is state, not place.** The URL never changes; the title never changes; browser Back exits the site; refreshing loses the section; essays cannot be linked. There is no 404.
- **Accessibility is thin where it matters.** The six menu cards are non-focusable divs, so the accessibility tree contains only four buttons. The 15 essay cards cannot be opened by keyboard. Content screens are not dialogs and focus stays on `<body>`. Five text pairs miss 4.5:1, the worst at 2.15:1.
- **Performance is dominated by two avoidable costs:** a **407 KB** Tailwind Play CDN script that compiles CSS at runtime and prints a production warning, and a single **461 KB** JS chunk (**150 KB gzip**) that contains every screen and all essay text. The background canvas renders at 1× on a 3× display, never cancels its RAF, and keeps drawing under every content screen and its full-viewport `backdrop-blur-md`.

### The bar I am reviewing against

The target is a **faithful PS2 *system* feel**, not a PS2 skin:

- Boot: black → blue fog → a field of translucent vertical monoliths with a slow camera move and a single bloom → an original wordmark (no Sony mark) → the system menu. The sound is a quiet pad with a glassy bell, not a sub-bass sweep.
- Browser/menu: a structured screen with a row or arc of system icons, one large selected-item panel with a name and a short description, the clock top-right, and a help bar that names the actual buttons. Selection is a bright, thin outline with a restrained glow; unselected items are quiet.
- System configuration / memory card: translucent blue panels, hairline rules, generous negative space, a thin wide-tracked sans, small mono metadata, and no more than a few real strings per region.
- Feedback: a short, bright cursor tick; a two-tone rising confirm; a deeper single-tone back; a low double error. A sound and a haptic are two expressions of the same event, never two separate inventions.
- Constraint: no Sony logos, glyphs, or audio. All marks and tones original.

---

## 2. How to read the plan

The plan has **39 numbered upgrades**. Sections are ordered by impact; items are numbered globally in the recommended shipping order, so numbering is not contiguous inside every section. Each item names the files to change, the principle behind it, the mobile and desktop effect, and the effort/risk. “Both” means the change is shared; where the impact differs it is called out.

Effort: **S** ≈ under a day, **M** ≈ 1–3 days, **L** ≈ 3–7 days for one designer/engineer. Risk is delivery risk (regression, platform, or taste), not severity.

---

## 3. Boot and intro

### 1. Gate the boot behind a deliberate power-on gesture, and align the chime

**What changes:** `components/BootSequence.tsx`, `utils/SoundManager.ts`, `components/App.tsx`. Replace the auto-start mount effect with a small “Power on” state: an original monogram or wordmark over black with “Press any button” and a real focusable control. On the first `pointerdown`/`keydown`/`Enter`, call `await soundManager.ensureRunning()` and then start the boot visual and its original chime together. Keep the gate to one screen and under 300 ms of visible delay. If audio is unavailable, start the visual anyway and never queue the chime for later.

**Why:** Autoplay policy makes the current chime impossible on a cold load. The boot is the site's one chance at a Peak-End moment; a silent, late pad destroys it. The current behavior is worse than silence because the pad starts when the visitor touches the menu (measured: ends at 14.98 s).

**Guide:** PS2 boot sequence fidelity (power-on → fog → monoliths → mark); Apple HIG: Sound (“use sound to support, not replace, feedback”) and WCAG 2.2 SC 1.4.2 (audio control for the 6 s pad); Family Values: Delight (selective emphasis — spend the big moment here, not on every hover).

**Mobile / desktop:** Mobile is where the gate matters most: iOS has no Web Audio until a gesture and respects the silent switch, so the gate is the only way to make the chime exist. Desktop gains keyboard activation and a clean `resume()`.

**Effort / risk:** M / low. The extra tap can feel like friction; make the gate visually part of the fiction (“SYSTEM READY — PRESS ANY BUTTON”) and let returning visitors skip via session storage.

---

### 2. Cut the boot to 1.4–1.8 s, make it skippable, and remove the dead black holds

**What changes:** `components/BootSequence.tsx:19-25` (4 s + 1.5 s timers), `components/App.tsx:61-68` (1 s exit), `App.tsx:60` (`mode="wait"`), `index.html` `--app-height` script only if it interacts. New sequence: 0–500 ms fog and first monoliths; 500–1,200 ms dolly and bloom; 1,200–1,600 ms mark resolves and the menu is already composited underneath; 1,600 ms crossfade complete. Add “Skip” from 300 ms on click, any key, or Escape. Store “seen this session” so a return within the session goes straight to the menu with a 300 ms fade. Under reduced motion, show a static poster (fog, one tower, mark, menu preview) for 400 ms and cut.

**Why:** 7.2 s to interaction is a user-control failure and the direct cause of a 6.7 s LCP. Doherty's threshold is 400 ms for flow; a 4 s unskippable animation tells the visitor the site does not care about their time. The 2.5 s of black also makes the site look broken rather than cinematic.

**Guide:** web.dev: LCP (target under 2.5 s); Nielsen Norman: user control and freedom + visibility of system status; Family Values: Simplicity (respect the user's time) and Fluidity (no static hold); Stage Show: the poster frame must tell the story on its own.

**Mobile / desktop:** Both. On mobile, the skip affordance must be a 44 px target and also respond to a tap anywhere; on desktop, any key plus Escape.

**Effort / risk:** S–M / medium. The risk is losing the “occasion.” Keep one full beat (the bloom + mark) and cut the rest; test that the mark is readable on a 390 px screen for at least 600 ms.

---

### 3. Rebuild the tower scene as one intentional composition, with an original payoff

**What changes:** `components/BootSequence.tsx:41-118`. Replace 25 independent random divs with a designed stage: a horizon gradient, three depth bands of 10–16 translucent monoliths with consistent widths/heights, a slow camera dolly and lateral drift, a single warm-white bloom near the centre, and a final 800 ms hold where an original wordmark or monogram (not a Sony mark, not a copied PS2 logo) resolves. The mark should be the same mark used in the favicon/portrait identity. Use one accent (PS2 blue) and one highlight (white/cyan); remove the purple cloud.

**Why:** The current field is visibly random: every reload differs, the elements have no relation to a horizon, and there is no brand payoff. Stage Show's core test is “a full, structured screen… a crop that puts the eye where the story is”; the eye currently lands on noise, then on nothing. A boot without a mark is a screensaver.

**Guide:** Stage Show: “It reads as a real product, simplified to what the viewer needs, framed with intent” + “Quiet hierarchy”; PS2 boot sequence reference (the monolith field and the central light); Family Values: Delight (a rare, high-impact moment) and Fluidity (the reveal should resolve, not stop).

**Mobile / desktop:** Both. On mobile, crop tighter (fewer, larger monoliths; no wide lateral drift) so the composition still has a focal point at 390 px; on desktop, allow the wider field.

**Effort / risk:** L / medium. This is the largest visual art task. Build it as a separate, swappable component and test at 390, 1440, and 390×500 landscape. Avoid WebGL unless you can budget it; layered CSS transforms and one canvas layer are enough.

---

### 4. Make the boot deterministic and compositor-friendly

**What changes:** `components/BootSequence.tsx:45-80`. Move all random values into a `useMemo` seeded per session (or a constant), so re-renders and StrictMode do not redraw a different field. Animate only `transform` and `opacity`; remove per-element `filter: blur()` and the two 600 px blurred cloud divs in favour of a single pre-blurred gradient texture. Reduce to 10–14 elements on coarse pointers/small screens. Do not re-randomize when `stage` changes.

**Why:** The current fadeout produces repeated 51–62 ms long tasks (measured), exactly when the visitor is waiting for the menu. Random values in render also make the scene pop on any re-render. Stage Show calls this a “glitch” that erodes trust; Family Values says motion should explain continuity, not redraw the world.

**Guide:** web.dev: INP and long tasks (keep the main thread free); Stage Show: “every motion has a cause” and “no redundant animation”; WCAG 2.2 SC 2.3.3 (animation from interactions must be disableable).

**Mobile / desktop:** Mobile gains the most: blurred full-screen layers are the first thing to drop frames on a low-end phone. Desktop can keep one soft bloom; mobile uses a gradient.

**Effort / risk:** M / low. Test on a throttled 4× CPU profile and confirm no task over 50 ms during the sequence.

---

## 4. Sound and haptics

### 5. Replace scattered calls with one interaction bus and one event policy

**What changes:** New `utils/Interaction.ts` (or a `useInteraction` hook) that owns `cursor | confirm | back | error | start` events. Each event maps to one sound and one optional haptic; components call `interact('confirm')` rather than importing `soundManager`/`hapticManager` directly. Delete the direct calls in `components/MainMenu.tsx:88-91`, `:99-102`, `:149-151`; `components/ContentScreen.tsx:250-256`, `:271-283`, `:293-299`, `:323-329`, `:362-368`, `:389-395`, `:481`, `:509`, `:587`, `:639`, `:724-730`, `:852`; and the scroll/route handlers. The bus enforces: no sound before `running`; one cursor tick per selection change; one haptic per activation; no haptic on hover; no sound on scroll; mute/haptics settings respected; `prefers-reduced-motion` disables haptics and long tails.

**Why:** Today the same physical action produces different feedback depending on which component it is in: media cards play hover + medium click, project cards play only a hover sound, the Book button plays nothing, the menu arrows play a blip, the Back button plays a deep tone and a medium haptic. There is no single place to fix autoplay, iOS, throttling, or settings. This is the root cause of the bug-scan's sound section.

**Guide:** Family Values: Delight (“consistent level of polish everywhere”; tactile feedback must match the action); Apple HIG: Feedback (match feedback to the action and use it sparingly); Material 3: state layers and interaction states; PS2 system reference: cursor/confirm/back are distinct, consistent events.

**Mobile / desktop:** Both. On mobile the bus fires from `pointerdown` (with the click reserved for navigation) so feedback is immediate; on desktop it fires from selection changes and activation, never from raw hover.

**Effort / risk:** M / medium. It touches every screen. Do it before adding new sounds; keep the old API as a thin adapter during the refactor and add a test that asserts one event per action.

---

### 6. Rebuild the sound palette: distinct cursor, confirm, back, boot, error

**What changes:** `utils/SoundManager.ts`. Replace the current four descending sines with composed original voices: cursor = 25–35 ms bright sine/triangle at ~1,100–1,400 Hz with a tiny noise transient and fast decay; confirm = two short notes rising (e.g., 660 → 990 Hz) with a soft bell tail; back = one deeper note falling (440 → 220 Hz) with a longer decay; error = two low muted pulses; boot = a quiet layered pad (200/300/450 Hz) plus a glassy bell at 520/780 Hz and a slow filter opening. Add a `DynamicsCompressorNode`, a master gain normalised to a real target (roughly −16 LUFS short-term, peak below −1 dBFS), per-voice gain, and a hard voice cap. Make sounds mono-safe and test on a phone speaker at 50% volume. Remove the 60→120 Hz boot sweep, which is mostly inaudible on phones.

**Why:** Confirm and back are both descending sines (300→100 and 200→100 Hz), so the ear cannot tell “open” from “cancel”; the boot is a 0.015 peak sub-bass sweep; every sound is quieter than the environment. The PS2 vocabulary is legible because each action has a distinct pitch contour and transient.

**Guide:** PS2 system UI reference: cursor/confirm/back timbres; Apple HIG: Sound (short, unobtrusive, distinctive); Family Values: Delight/selective emphasis (frequent actions get a small, repeatable tick; rare actions get the richer chime).

**Mobile / desktop:** Both. Test on the iPhone speaker and a laptop; bass-heavy voices disappear on phones. Keep the boot pad quiet enough not to startle on headphones.

**Effort / risk:** M / low–medium. Taste risk; build a small sound lab page or a dev-only keyboard trigger to audition all five at matched loudness before wiring them in.

---

### 7. Fix the haptic model: touch-only, activation-safe, iOS-aware, one per action

**What changes:** `utils/HapticManager.ts:10-77` and every caller. Detect a coarse pointer (`matchMedia('(pointer: coarse)')`) and `navigator.userActivation?.isActive`; expose only `tick`, `confirm`, `success`, `error` with meaningful durations (tick 12–15 ms, confirm 20–25 ms, success a short pattern). Remove all `hapticManager.*` calls from `onMouseEnter` (`ContentScreen.tsx:294-297`, `:324-327`, `:363-366`, `:390-393`, `:724-727`). Fire the haptic in `pointerdown` or the click, not both. On iOS, either implement the hidden switch fallback inside a real click (and test on device) or explicitly ship no haptics there; do not infer support from the desktop `navigator.vibrate` object. Cancel a pending pattern before a deliberate new one, but never let a stray tick cancel success/error.

**Why:** Measured on an iPhone-emulated tap: one click produced vibrations `[10, 20]` because mouseenter and click both fired. On Android, the hover call is outside activation and is dropped. On iOS there is no Vibration API at all. The result is no haptics on the platform the design is most suited to, double haptics on Android, and a no-op on desktop.

**Guide:** Apple HIG: Haptics (use sparingly, match meaning, never on scroll/hover); Family Values: “tactile feedback that matches the action”; WCAG 2.2 SC 2.5.8 is about target size, not haptics, but the same “one action, one response” logic applies; Android Vibration API guidance on user activation.

**Mobile / desktop:** Mobile is the whole point; desktop should be silent and still report the setting as unavailable rather than pretending. Haptics should switch off with reduced motion.

**Effort / risk:** M / medium. The iOS switch fallback is brittle across WebKit versions; keep it behind a feature flag and a device test, and ship the honest “no haptics on this device” state if it fails.

---

### 8. Add persistent sound, haptics, and motion settings

**What changes:** `components/MainMenu.tsx` (new small settings affordance near the clock or in the help bar), `components/ContentScreen.tsx:925-935` (footer), `utils/SoundManager.ts`, `utils/HapticManager.ts`. A compact “SYSTEM” panel with three toggles: Sound, Haptics, Reduced motion (Auto/On). Use `aria-pressed`, visible labels, a 44 px hit area, `localStorage` (`jsb.prefs.v1`), and the `M` shortcut for sound. Show a small speaker icon in the menu footer. On first run, if audio is unavailable (iOS silent switch or autoplay blocked), show one dismissible line in the help bar, not a modal. Announce changes in a polite live region.

**Why:** There is currently no way to mute the site, no persistence, and `isMuted` is dead code. A site that makes sound on load without a control is hostile in an office, on a train, or with a screen reader. Reduced motion is also a user preference that should be visible, not only inherited.

**Guide:** WCAG 2.2 SC 1.4.2 (audio control); Apple HIG: Settings and Sound; Nielsen Norman: user control and user preferences; Family Values: Simplicity (one small panel, gradual revelation).

**Mobile / desktop:** Both. On mobile, surface sound/haptics first because both can be unavailable; on desktop, keep the same panel but the haptics row can read “Not available on this device.”

**Effort / risk:** S–M / low. Default sound off until the power-on gesture, haptics on for coarse pointers only.

---

### 9. Make the cursor sound follow focus and selection, not a carpet of hovers

**What changes:** `components/MainMenu.tsx:214-215`, `components/ContentScreen.tsx` hover handlers, `components/ContentScreen.tsx:760-789` tab clicks. Remove sound from raw `onMouseEnter`. Give the menu a single selected index (pointer hover updates it; focus updates it; arrows update it) and play one cursor tick when it changes, throttled to ~60 ms. In lists, play the tick when the focused/hovered row changes, not when the pointer crosses decorative cards; add `onFocus` parity for links and buttons. Add a 60–80 ms debounce and ignore `event.repeat`.

**Why:** Measured: moving down the essay list produced 10 sounds and 9 haptic calls in about a second, while tabbing through the same list produced none. That is both noisy and inaccessible. Frequent actions should be quiet and consistent; the cursor is the most frequent sound in a system UI.

**Guide:** Family Values: Delight-Impact Curve (frequent actions get small touches; selective emphasis); WAI-ARIA APG: focus management and visible focus; Laws of UX: Doherty threshold (feedback within 100 ms) and Fitts's Law (selection targets); Stage Show: “the cursor is a cause, not decoration.”

**Mobile / desktop:** Desktop gains the most (hover is the dominant input); mobile uses the same selection model via tap/swipe with one tick per change. Focus parity benefits keyboard and screen-reader users on both.

**Effort / risk:** S / low. Centralise in the bus from item 5 so this is a policy change, not a hunt.

---

## 5. Performance and asset delivery

### 10. Remove the Tailwind Play CDN and ship compiled CSS

**What changes:** `index.html:33` (remove `cdn.tailwindcss.com`), `index.html:71-82` (remove the unused import map), `vite.config.ts` and `package.json` (add Tailwind as a build step, or replace utilities with a small `styles/app.css`). If keeping Tailwind, scan `index.html` and `**/*.tsx` at build time and emit a hashed stylesheet. Add a visual smoke test at 390 and 1440 to catch missing arbitrary values.

**Why:** The CDN is **407,279 bytes** before gzip, runs a compiler in the browser, warns in the console, and leaves the page unstyled until it executes. It is the second-largest transfer after the app and the largest third-party script. Compiling the same utilities at build time removes the runtime cost and the warning.

**Guide:** web.dev: render-blocking resources and LCP; RAIL: keep the main thread free during load; Family Values: table stakes (utility and performance).

**Mobile / desktop:** Both, with a larger absolute win on mobile networks. Verify `perspective` (see item 21), arbitrary values such as `text-[10px]`, `bg-[#050a14]`, and `shadow-[…]` survive the build.

**Effort / risk:** M / medium. Utility output can drift; compare computed styles on every screen before and after. Removing the CDN may expose utilities that only existed because the CDN generated them at runtime.

---

### 11. Split the JS by screen and load essay text on demand

**What changes:** `components/App.tsx`, `components/ContentScreen.tsx:17-31`, `constants.tsx`, `data/essays.ts`. `React.lazy` the content shell; split each section and each content tab; import essay bodies by slug (dynamic `import()` or a small JSON fetch) instead of bundling all 67 KB of essay source into the initial chunk. Replace full `framer-motion` with `LazyMotion` + `m` for the simple fades, or CSS transitions; keep the spring only where it earns its weight. Audit `lucide-react` imports (only a few icons are used) and replace the custom SVG set with the same sprite. Target under ~120 KB gzip for the menu path.

**Why:** The production bundle is **461,542 bytes / 150,169 bytes gzip** in one chunk and includes every screen and all essay text. The menu needs none of it. This is the largest controllable LCP/TBT cost after the CDN.

**Guide:** web.dev: code splitting and “reduce JavaScript payloads”; Doherty threshold (perceived speed); Family Values: table stakes.

**Mobile / desktop:** Both; mobile networks and low-end CPUs benefit most. Prefetch the most likely section on idle or on menu focus so the split does not add a visible wait.

**Effort / risk:** M–L / medium. Splitting introduces loading states; design them (item 38) and keep a preloaded skeleton so the panel does not flash empty.

---

### 12. Self-host a PS2-appropriate type system and ship image renditions

**What changes:** `index.html:34` (remove Google Fonts), new `public/fonts/*` (subset woff2), `styles/app.css` type tokens, `constants.tsx:119` and `components/ContentScreen.tsx:645-649` (book cover), `data/essays` image paths. Use one variable geometric sans with a Futura/Jost-like skeleton at weights 200–400 for display/UI and prose, plus one mono for metadata only. Subset to Latin, preload the two files, `font-display: swap`. Export the book cover at 640×960 and 320×480 WebP/AVIF (~40–60 KB), add `width`/`height` and `loading="lazy"`. Serve essay images with `srcset` and explicit aspect ratios.

**Why:** The blocking Google CSS is 12 KB and the site still uses Inter bold and JetBrains Mono for long prose, which fights the thin PS2 system type. The book cover is **587,783 bytes** at 2048² for a 192×288 CSS slot. Fonts and images are the remaining render-blocking/large-transfer items after the CDN.

**Guide:** web.dev: font best practices and modern image formats; PS2 system type reference (thin, wide-tracked geometric sans); Apple HIG: Typography (legibility first).

**Mobile / desktop:** Both. On mobile the cover rendition and font subset matter most; on desktop the lighter display face fixes the “bold dashboard” look.

**Effort / risk:** M / low. Licensing: choose an OFL/Apache face and keep the license file. Test fallback metrics to avoid a swap jump.

---

### 13. Give the background and overlays a real animation budget

**What changes:** `components/PS2Background.tsx:15-19`, `:47-164`; `components/App.tsx:104`; `components/ContentScreen.tsx:899`. Size the canvas backing store to `min(devicePixelRatio, 2)`; cache the radial gradient and tower sort; drop `shadowBlur` for a sprite; cap at 30 fps; pause on `document.hidden`, when a content screen is open, and under reduced motion; store and cancel the RAF. Remove the full-viewport `backdrop-blur-md` from the content shell (the inner panel is opaque and the blur is only visible in a 16–48 px gutter) and replace it with a simple translucent gutter. Reduce the CRT overlay to 3–4% monochrome scanlines and disable it on coarse pointers/reduced motion.

**Why:** The canvas renders at **390×664 on a 3× device**, so it is visibly soft, yet it pays for 50 towers, a per-frame sort, a new radial gradient every frame, and `shadowBlur`. It keeps running under every content screen, behind a full-screen backdrop blur. The CRT overlay sits above text at 10% opacity with an RGB split, reducing legibility on small type.

**Guide:** web.dev: INP and animation performance; WCAG 2.2 SC 2.3.3 (reduced motion) and SC 1.4.3 (the overlay must not lower contrast); Stage Show: “between a richer story and a calmer frame, choose the frame.”

**Mobile / desktop:** Mobile is the priority (DPR 3, weaker GPU); desktop can keep a subtler 30 fps layer. The content gutter can use a static gradient on both.

**Effort / risk:** S–M / low. Visual regression: the background may look flatter; compensate with one well-placed gradient rather than many blurred layers.

---

## 6. Navigation, history, and state

### 14. Give every screen a URL, a title, and a working Back button

**What changes:** `components/App.tsx:21-37`, `components/ContentScreen.tsx:249-257`, `index.html:7`, `index.html:15-31`. Introduce routes: `/`, `/about`, `/social`, `/work`, `/portfolio`, `/portfolio/investments`, `/portfolio/design`, `/book`, `/content/essays`, `/content/essays/:slug`, `/content/:tab`. Use `history.pushState`/`popstate` (or a tiny router; no dependency needed). Set `document.title`, meta description, canonical, and OG per route. On GitHub Pages, publish a `404.html` that boots the app for path routes, or use hash routing. Browser Back from an essay must return to the essay list, not leave the site.

**Why:** Verified: after opening Content, browser Back returns to the previous site and the URL/title never change. Refresh loses the section; essays cannot be linked or indexed; the site has one address for eight screens. This is the largest structural UX gap after the boot.

**Guide:** Nielsen Norman: visibility of system status + consistency with the web; WCAG 2.2 SC 2.4.2 (page titled); web.dev: SPA routing and crawlable content; Family Values: preserve context (the user should know where they are and how they got there).

**Mobile / desktop:** Both. On mobile the system back gesture is the primary navigation; today it exits the site. On desktop, deep links make the work shareable.

**Effort / risk:** M / medium. Routing changes the modal model; coordinate with item 15. Test direct loads, refresh, back/forward, and unknown slugs.

---

### 15. Treat content screens as dialogs (or pages) with focus and scroll restoration

**What changes:** `components/ContentScreen.tsx:897-935`; `components/App.tsx:76-98`. Add `role="dialog" aria-modal="true" aria-labelledby="screen-title"`, move focus to the title or Back on open, trap Tab, restore focus to the invoking card on close, and handle Escape. Add a visually hidden H1. Save the list scroll offset and selected card id before opening an essay and restore both on return; focus the card and announce “returned to Essays.” Remove the unconditional `bodyRef.current?.scrollTo(0,0)` on every `selectedEssay` change (`:236-238`) and replace it with explicit open/close positions.

**Why:** Verified: after opening About, `document.activeElement` is `BODY`; there is no accessible name, no trap, no Escape, and no focus return. Returning from an essay scrolls the list to the top and loses the reader's place. This is a direct failure of “preserve context” and of dialog semantics.

**Guide:** WAI-ARIA APG: Dialog (Modal) pattern; WCAG 2.2 SC 2.4.3 (focus order) and 2.4.7 (focus visible); Family Values: Preserve context (S2) and Fluidity (return should feel like going back, not teleporting to the top).

**Mobile / desktop:** Both. Mobile benefits most from the back gesture mapping to the dialog close and from restoring the list position after a long scroll.

**Effort / risk:** S–M / medium. If item 14 introduces real pages, the “dialog” may become a route transition; keep the same focus contract either way.

---

### 16. Make transitions directional and keep persistent chrome still

**What changes:** `components/App.tsx:84-98`, `components/ContentScreen.tsx:41-53`, `:572-578`, `:792-798`. Replace the generic `scale(0.9→1)` / `scale(1.05)+blur` pair with a directional relationship: opening a section grows the selected orb/panel into the screen (container transform), closing shrinks back to the same item, moving between tabs slides the content along the tab order (left/right), and the header, tab bar, and help bar stay fixed while only the body moves. Use 180–280 ms and one easing curve (`cubic-bezier(0.2, 0.8, 0.2, 1)`), not 0.8 s springs. Keep the background still during the transition.

**Why:** Today every screen uses the same zoom-and-blur, and `AnimatePresence mode="wait"` serialises exits and entries (menu → content ≈ 570 ms; back ≈ 1.1 s). The transition does not say where you came from or where you are going, and the whole panel (including its header) moves, which is redundant. Family Values: “we fly instead of teleport”; “if a component persists, it should remain consistent.”

**Guide:** Family Values: Fluidity (directional motion, no redundant animation, morph don't swap); Material 3: container transform and shared axis; Stage Show: “animate the relationship, not just the object.”

**Mobile / desktop:** Both. On mobile, the origin should be the tapped card so the screen feels attached to the finger; on desktop, the same origin makes the carousel-to-screen move legible. Respect reduced motion: fade only.

**Effort / risk:** M / medium. Framer Motion layout animations can be expensive; measure and consider CSS view transitions where supported with a fallback.

---

### 17. Rebuild the help/footer bars as one context-aware system

**What changes:** `components/MainMenu.tsx:338-374`, `components/ContentScreen.tsx:925-935`. One bar, one visual language: real keycaps on keyboard, “Tap / Swipe” on touch, and only the actions available on that screen. Menu: `← →` browse, `Enter` open, `M` sound, `Esc` (nothing/back). Content: `Esc` or Back, `↑↓` scroll, maybe `1–6` tabs. Remove the duplicate tiny arrow buttons that duplicate the big arrows; if kept, give them 44 px hit areas. Use original glyphs, not Sony button symbols. Make the bar `aria-hidden` for decorative keycaps and provide the same instructions in an accessible description; do not rely on colour alone for the active state.

**Why:** The current bar mixes a non-interactive “ENTER” keycap with interactive arrow buttons, repeats the same `aria-label` on four controls, says “Press Enter” on touch devices, and shrinks the whole thing to ~7.5 px on mobile. It also disappears on content screens except for Back, so the visitor has to relearn the controls each time.

**Guide:** PS2 system UI reference: the persistent help bar names the actual buttons; Apple HIG: keyboard shortcuts should be discoverable; WCAG 2.2 SC 2.5.8 (target size) and 2.4.7 (focus); Stage Show: “fit every control's text before it moves.”

**Mobile / desktop:** Mobile needs a touch-specific legend and 44 px controls; desktop needs a compact keycap legend. Do not show both at once.

**Effort / risk:** S / low. Keep the same component and switch content by pointer media query.

---

## 7. Main menu

### 18. Recast the menu as a PS2 system browser with a selected-item panel

**What changes:** `components/MainMenu.tsx:165-289`, `constants.tsx:191-198`. Replace the orbit of six equally weighted orbs with a PS2-browser composition: a bottom (or side) row/arc of six original system icons, one large selected panel above it showing the icon, the section name, its `description` (currently dead data), and a short “open” affordance; a clock top-right; a thin horizontal rule and a help bar. Keep the blue fog and a subtle orbit line in the background, not as the primary structure. Use the `color` field only as a restrained accent (or remove it); PS2 system UI is mostly one blue plus white.

**Why:** The current carousel reads as a sci-fi product selector, not a system browser. The eye lands on six glowing rings with no hierarchy beyond scale, the description is never shown, and the composition has no “selected item” panel. Stage Show's “one signal, quiet hierarchy” and the PS2 browser's large selected-item area both point to the same fix. Showing the description is also the simplest way to make the menu informative rather than decorative.

**Guide:** PS2 system browser reference (icon row + selected panel + clock); Stage Show: “quiet hierarchy,” “a budget for words, not elements,” and “frame with intent”; Family Values: Simplicity (gradual revelation — the description appears when relevant).

**Mobile / desktop:** Desktop can show the full row plus selected panel; mobile should show one large selected panel and a compact icon strip (or a card stack with the next item peeking), not six tiny orbs. Keep the 390 px composition readable without scaling text below 12 px.

**Effort / risk:** L / medium. This is a visual re-architecture; keep the existing state/props and replace the render tree. Test active/selected/hover/focus at both widths.

---

### 19. Give the menu real list semantics, roving focus, and a visible focus ring

**What changes:** `components/MainMenu.tsx:200-223`. Use a `role="listbox"` with `role="option"` and `aria-selected`, or a `tablist` if the menu is conceptually tabs; give the container a roving `tabIndex` (0 on the active item, −1 on the rest), handle ArrowLeft/Right/Home/End, Enter/Space to open, and `aria-activedescendant` if focus stays on the container. Add a 2 px white/blue focus ring with a 2 px offset, independent of the selected glow. Announce the active section and description in a polite live region. Remove the global Enter shortcut or guard it against interactive targets (`MainMenu.tsx:95-106`).

**Why:** Verified: the accessibility tree contains only the two big arrows and the two footer arrows; the six sections are invisible to keyboard and screen-reader users, and pressing Enter on a focused button opens a section. A PS2 menu that cannot be driven by a keyboard is not a system menu.

**Guide:** WAI-ARIA APG: Listbox and Tabs patterns; WCAG 2.2 SC 2.1.1 (keyboard), 2.4.7 (focus visible), 4.1.2 (name, role, value); Family Values: consistency (same model for pointer and keyboard).

**Mobile / desktop:** Desktop is where the keyboard model matters; mobile still benefits from the semantics for VoiceOver/TalkBack and from focus not being trapped in decorative divs.

**Effort / risk:** M / medium. Decide whether the menu is a listbox (single selection) or tabs (navigation); do not mix. Test with VoiceOver/TalkBack and with a keyboard only.

---

### 20. Make the mobile menu a direct-manipulation carousel, with honest targets and copy

**What changes:** `components/MainMenu.tsx:108-142` (swipe), `:291-328` (arrows), `:352-367` (footer arrows), `:273-280` (“Press Enter”). Add pointer-follow dragging with a spring snap and velocity threshold (not just a 50 px delta on touchend); set `touch-action: pan-y`; cancel on `touchcancel`; show a subtle next-card peek and a dots/counter indicator; add 44 px previous/next hit areas at the edges (or visible 44 px buttons); change the hint to “Tap to open · Swipe to browse”; keep the label and description at ≥12 px after the scale transform; only the centred card is tappable, or a tap on a neighbour first centres it and a second tap opens (consistent with desktop hover → click).

**Why:** On a 390 px screen the only controls are 20 × 20 px; the carousel snaps only after release; the peeking neighbours are immediately tappable and open on one tap; the copy tells phone users to press Enter; and the footer is the smallest text on the page. This is a touch-first site being driven by a desktop model.

**Guide:** Apple HIG: Direct manipulation and Touch targets (44 pt); Material 3: swipe and motion; Family Values: Fluidity (“we fly instead of teleport”) and Delight (a satisfying snap); WCAG 2.2 SC 2.5.8.

**Mobile / desktop:** Mobile-first; desktop keeps arrow buttons and keyboard. The drag should be disabled during the boot and under reduced motion (use a crossfade instead).

**Effort / risk:** M / medium. Pointer events plus Framer Motion springs can fight; use one pointer handler and `requestAnimationFrame` for the offset, then commit on release.

---

### 21. Make hover preview the selection and click confirm it

**What changes:** `components/MainMenu.tsx:190-215`. On pointer hover, update the active index (one cursor tick) and let the selected panel/description follow; on click/Enter, confirm and open. Remove the independent `hoveredIndex` scale-only state. Add the missing `perspective: 1000px` on the carousel stage (the `perspective-1000` Tailwind class is not generated), and reduce the tilt so neighbours read as depth, not as squashed cards. Only the active item gets the bright outline and glow; neighbours get a 1 px low-contrast line.

**Why:** Hover currently grows a card but leaves the active item and “Press Enter” elsewhere, so the pointer and keyboard teach different models; clicking a half-visible neighbour opens it without preview. The 3D claim is also not rendered because the utility is absent. A system UI has one cursor and one selected item.

**Guide:** PS2 system UI reference: the cursor moves the highlight, then confirm opens; Family Values: Fluidity (continuous feedback) and consistency; Laws of UX: Fitts's Law (larger active target) and feedback under 100 ms.

**Mobile / desktop:** Desktop only for hover; mobile uses swipe/tap with the same selected state. The perspective fix helps both.

**Effort / risk:** S / low. If opening on a single click is a deliberate choice, remove the two-step copy and make the selected state purely a swipe/keyboard concept.

---

## 8. Content hub and tabs

### 22. Rebuild the Content and Portfolio tabs on one accessible tab component

**What changes:** `components/ContentScreen.tsx:532-568` (Portfolio) and `:760-789` (Content). One `Tabs` component with `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `id`, `role="tabpanel"` + `aria-labelledby`, roving `tabIndex`, ArrowLeft/Right/Home/End, and a focus style. On mobile, use a two-row segmented control (3×2) or a scroll-snap strip with visible edge fades and chevrons, so “Reading” is never hidden with no cue. Respect reduced motion in `scrollIntoView`. Reuse the same component for Portfolio’s Projects/Investments/Design.

**Why:** Verified: at 390 px the Content tab strip is 641 px in a 356 px viewport; “TUTORIALS” is cut and “READING” is entirely off-screen. All tabs are in the Tab order, arrow keys do nothing, and there is no tabpanel. Portfolio tabs are plain buttons with no ARIA and a 2.15:1 inactive colour. Two tab implementations have already drifted.

**Guide:** WAI-ARIA APG: Tabs pattern; WCAG 2.2 SC 2.1.1, 2.4.7, 1.4.3; Laws of UX: Hick's Law (six tabs is at the edge; grouping helps) and Fitts's Law (target size).

**Mobile / desktop:** Mobile needs the alternate layout and larger targets; desktop can keep a single row but gains keyboard behaviour and a correct selected state.

**Effort / risk:** M / low–medium. The store is simple; the risk is styling the two contexts differently. Keep one component with a `variant` prop.

---

### 23. Animate tab changes directionally and keep the tab bar still

**What changes:** `components/ContentScreen.tsx:572-578`, `:792-798`. Key the panel by tab, but animate it along the tab order: moving from Essays to Posts slides the new panel in from the right and the old out to the left (reverse for going back), with a 180–240 ms shared-axis transition and a small fade. Keep the header and tab bar mounted and still; only the body moves. Do not remount the tab bar (currently `renderContentTabs` is outside the keyed panel, which is correct — preserve that). For the essay list → reader, slide the reader in from the direction of the selected card, and reverse on back.

**Why:** Today every tab change is the same 10 px upward fade of a freshly mounted panel, so the direction of travel is lost; the header and tabs are re-rendered but visually static. Family Values' cardinal example is exactly this: switch tabs with directional motion so the user feels the space. It also removes the “digital whiplash” of a swap.

**Guide:** Family Values: Fluidity (directional motion, “we fly instead of teleport”); Material 3: shared axis; Stage Show: “content that swaps instead of moving” is a named fault.

**Mobile / desktop:** Both. On mobile the direction should follow the swipe as well as the tap, so a horizontal gesture and a tab change tell the same story.

**Effort / risk:** S–M / low. Avoid animating height; let the body scroll container own its size and fade the content within it.

---

### 24. Tame the long lists with counts, search, grouping, and progressive disclosure

**What changes:** `components/ContentScreen.tsx:799-841` and `data/*`. Add a count and a one-line description to each tab (“Essays · 15 · newest first”), a search field for Essays/Posts/Podcasts/Lectures, a year or source filter for Lectures/Podcasts, and “Show more” (20 at a time) instead of rendering all 40 posts and the full podcast list at once. Group Lectures by year and venue; group Value Stack episodes by year. Keep the first three items visible without interaction. Add an empty state when a filter yields nothing.

**Why:** The content hub is strong but flat: dozens of identical cards with no way to scan, search, or know how much is there. Hick's Law says the time to choose grows with the number of equal options; the current design gives every item the same weight. The 40-post tab also eagerly loads 40 remote images.

**Guide:** Laws of UX: Hick's Law and recognition over recall; Nielsen Norman: help users scan and find; Family Values: Simplicity (gradual revelation); Stage Show: “a budget for words, not elements.”

**Mobile / desktop:** Mobile benefits most from “Show more” and search; desktop can show a denser two-column index and a sidebar filter. Do not hide the search behind an icon on desktop.

**Effort / risk:** M / medium. Search adds state and empty states; keep it client-side and debounced, and make sure filter changes do not reset scroll to zero unexpectedly.

---

### 25. Build one card/row system with consistent hover, focus, active, and external cues

**What changes:** `components/ContentScreen.tsx:287-379`, `:571-620`, `:844-881`. Extract a `SystemCard`/`SystemRow` with three visual states (rest, hover/focus, active/pressed) and one link target. The whole card is one link; the external icon is persistent (not hover-only) and `aria-hidden`; the accessible name ends with “(opens in a new tab)” where relevant. Use `onFocus` and `onMouseEnter` only to set a shared hovered/focused id (the bus plays one tick); use `:active` for a 1–2 px press. Add lazy images with dimensions. Remove the duplicated icon+overlay anchors in project cards.

**Why:** Every list currently invents its own interaction: media cards play hover + haptic + medium click, investment rows play hover only, design figures play hover only, project cards have two links, and some cards have no keyboard path at all. Family Values' “consistent polish everywhere” is the standard; the external cue disappearing on touch is a real usability bug.

**Guide:** Family Values: Delight (“consistent level of polish everywhere”) and tactile feedback; WCAG 2.2 SC 2.4.4 (link purpose) and 2.4.7 (focus visible); Apple HIG: states and feedback.

**Mobile / desktop:** Both. Touch has no hover, so the focus/pressed state must carry the feedback; desktop gets a single hover tick and a clear focus ring.

**Effort / risk:** M / medium. Touches every list; do it with the interaction bus and a shared component, not per-screen patches.

---

## 9. Essay reader

### 26. Set the reader in prose type and parse real headings

**What changes:** `components/ContentScreen.tsx:68-193` (`renderInline`, `EssayBody`), `:685-716`. Parse Markdown headings (`##`, `###`) into semantic `h2`/`h3` with anchors; support lists, blockquotes, horizontal rules, inline code, and figure captions. Set body copy in the display/prose face at 17–18 px with a 1.6–1.7 line-height and a 60–70 character measure (`max-w-[65ch]`); use the mono face only for the date, read time, and metadata. Give links a persistent underline and a 3:1 non-text contrast. Keep the PS2 mood via the panel, rules, and small caps — not by setting a 1,500-word essay in 14 px monospace.

**Why:** The reader currently uses `font-mono` 14 px on mobile, with 308 px of text width; headings inside essays are inline bold spans, so the document has one H3 (the title) and no section structure. Long-form reading is the core content of the site; it should be the most comfortable screen, not the least.

**Guide:** Apple HIG: Typography and legibility; WCAG 2.2 SC 1.4.8 (visual presentation: line length, spacing) and 1.3.1 (info and relationships); PS2 system type (thin sans, wide tracking) applied to prose; Stage Show: real content where the eye lands.

**Mobile / desktop:** Mobile is the primary reading surface; test 390 px with the browser UI visible. Desktop should cap the measure and avoid a 768 px-wide mono column.

**Effort / risk:** M / medium. Markdown parsing can be a small hand-written function (the data is controlled) or a 3 KB parser; do not add a heavy CMS. Preserve the existing `%%YOUTUBE/IMAGE/TWEET%%` tokens.

---

### 27. Add reader chrome: progress, contents, next/previous, copy link

**What changes:** `components/ContentScreen.tsx:685-716`, `:909-935`. A sticky reader header with the title, date, read time, and a thin top progress line; a collapsible “Contents” for essays over ~6 minutes; previous/next essay at the foot; a “Copy link” action (with a `success` haptic/sound and an `aria-live` confirmation); a persistent Back to list. Keep the list scroll position and restore focus on return (item 15).

**Why:** A 2,000-word essay currently has no orientation, no progress, no way to jump, no way to continue to the next piece, and no way to share it because it has no URL. These are the basic affordances of a reading surface. The progress line is also a rare, high-value place for the PS2 glow.

**Guide:** Nielsen Norman: visibility of system status and user control; Family Values: Preserve context (S2) and Delight-Impact Curve (a completion/progress moment is rare and earns emphasis); WCAG 2.2 SC 2.4.1 (bypass blocks) and 4.1.3 (status messages).

**Mobile / desktop:** Mobile needs a compact sticky bar and a 44 px back/copy; desktop can show the contents in a side rail. Do not let the progress line cover the title.

**Effort / risk:** S–M / low. “Copy link” should copy the canonical URL once routing exists; until then it is a placeholder.

---

### 28. Give every essay a permalink, metadata, and a shareable card

**What changes:** routing from item 14; `data/essays.ts` (slug/date/excerpt already present); `index.html` (static OG is home-only). Add per-essay `<title>`, meta description, canonical, `og:title/description/image`, `Article` JSON-LD, and a generated OG image (or reuse the portrait for now). Add a `sitemap.xml` and `robots.txt` generated at build time. Ensure the initial HTML for an essay route contains the title/excerpt (prerender or a static shell) so crawlers and link unfurlers see it.

**Why:** The essays are the site's most valuable content and are currently invisible as individual documents: one URL, one title, one OG image. Sharing an essay on X shows the site card, not the essay. This also fixes the refresh/deep-link failure.

**Guide:** web.dev: SEO and structured data; WCAG 2.2 SC 2.4.2 (page titled); Nielsen Norman: shareability and orientation.

**Mobile / desktop:** Both; link unfurlers are desktop/social crawlers, but the copy-link action is primarily mobile.

**Effort / risk:** M / medium. Prerendering adds build complexity; a static shell plus client hydration is enough for metadata, but test how GitHub Pages serves the route (404 fallback).

---

## 10. Typography and colour

### 29. Replace the bold dashboard type with a PS2 system type scale

**What changes:** `index.html:34`, `styles/app.css` (new tokens), `components/MainMenu.tsx:267-281`, `components/ContentScreen.tsx` headings/labels, `components/ContentScreen.tsx:661` (serif book title). One display face at weights 200–400, tracking 0.12–0.2em for uppercase labels, a scale of 12 / 14 / 16 / 20 / 28 / 36 px with a 1.25–1.35 ratio, and a rule: glow only on the selected item and the screen title, never on body copy. Use tabular numerals for the clock and dates. Remove the `font-serif` book title. Keep the mono face for metadata and keycaps only.

**Why:** The current system is Inter 300/400/600 plus JetBrains Mono, with 10 px labels, bold 20 px uppercase menu items, a 24 px screen title, and `text-shadow` on almost every white heading. The result reads as a dark SaaS dashboard with a blue filter, not a thin system UI. PS2 system text is light, wide, and quiet; the glow is an accent, not a default.

**Guide:** PS2 system UI reference (thin, wide-tracked, low-weight type); Apple HIG: Typography; Stage Show: quiet hierarchy; Laws of UX: aesthetic-usability (restraint reads as quality).

**Mobile / desktop:** Mobile needs a 16 px minimum for body and 12 px for metadata after scaling; desktop can use the 12 px label scale. Never scale a text-bearing subtree below 12 px effective.

**Effort / risk:** M / medium. A full type pass touches every screen; do it with tokens and a visual checklist rather than one-off classes.

---

### 30. Fix contrast, restrain the CRT overlay, and commit to one blue

**What changes:** `styles/app.css` tokens + `components/App.tsx:104`, `components/ContentScreen.tsx:899`, `components/ContentScreen.tsx:486-495`, `:780`, `:542-566`, `:875`, `:660`, `components/MainMenu.tsx:345`. Define `--bg`, `--panel`, `--text`, `--text-secondary`, `--text-muted`, `--accent`, `--accent-soft`, `--success`, `--danger`. Raise the failing pairs to ≥4.5:1 (footer 3.42 → ≥4.5, inactive content tabs 4.26 → ≥4.5, inactive portfolio tabs 2.15 → ≥4.5, location 3.83 → ≥4.5, book subtitle 3.76 → ≥4.5). Remove the purple cloud and purple status; use one PS2 blue plus white/cyan and a single amber for warnings. Reduce the scanline overlay to 3–4% monochrome and place it behind text (or disable it on coarse pointers and reduced motion); remove the RGB split.

**Why:** Contrast is measured, not subjective. The RGB scanline overlay sits above all text at 10% with a red/green/blue stripe pattern, which is worst on the smallest type; the 2.15:1 inactive tab is effectively invisible. The purple accent is the one colour that breaks the PS2 blue field.

**Guide:** WCAG 2.2 SC 1.4.3 (contrast), 1.4.11 (non-text contrast), 1.4.1 (use of colour); PS2 palette reference (blue fog, white, cyan); Family Values: consistent polish; Apple HIG: Colour.

**Mobile / desktop:** Both. On mobile, the scanlines are more visible because the device is closer and the text smaller; disable them there first.

**Effort / risk:** S / low. Keep a contrast check in the design review checklist for every new token pairing.

---

## 11. Screen-by-screen

### 31. About: make the portrait and the beliefs the composition

**What changes:** `components/ContentScreen.tsx:408-467`. Increase the portrait from 144/160 px to a proper 240–320 px panel with a thin PS2 frame and a caption; make the mission line a 24–28 px pull quote; turn Core Beliefs and Current Objectives into two aligned panels with 12 px labels and 16 px body; replace the `▶`/`◉` text markers with small original glyphs marked `aria-hidden`; add cross-links to the Book, Work, and Social screens; add a short “now” line with the current role. Keep the body at 60–70 characters.

**Why:** About is the most personal screen but currently reads as a small avatar above two bullet lists. The portrait is the strongest identity asset (used for the favicon and OG image) and is displayed at less than half the width it deserves. The list markers are announced as “black right-pointing triangle” by screen readers.

**Guide:** Stage Show: focal object and quiet hierarchy; Family Values: Delight through selective emphasis (this is a rare, high-emotion screen); WCAG 2.2 SC 1.1.1 (decorative markers) and 1.4.8.

**Mobile / desktop:** Mobile should lead with the portrait and mission quote, then the two belief panels stacked; desktop can use a two-column layout with the portrait on the left and a 60ch column on the right.

**Effort / risk:** S–M / low. Keep the text; change the composition and type.

---

### 32. Social: make it a contact surface, not a link list

**What changes:** `components/ContentScreen.tsx:381-406` and `constants.tsx:186-190`. Put email first as the primary action with a copy button (morphs to “Copied”, plays confirm, announces politely), then X and LinkedIn as secondary rows with persistent platform marks and handles. Remove `target="_blank"` from `mailto:`. Add a short line about what he is open to (podcasts, advising, speaking) and a response-time note. If a QR code is added, generate it locally, not via a third-party image.

**Why:** “Social” currently shows three identical rectangles; the most useful action (email) has the same weight as the others and opens a blank tab. On mobile the external-link icon never appears. A contact screen should reduce the steps to “say hello.”

**Guide:** Laws of UX: Fitts's Law (make the primary action large) and Hick's Law (three choices are fine, but rank them); Family Values: Preserve context (copy in place) and Delight (a small success moment); WCAG 2.2 SC 2.5.8.

**Mobile / desktop:** Mobile: email row full width, copy button 44 px. Desktop: the same hierarchy, with the handle visible and a QR option for passing a phone.

**Effort / risk:** S / low. Copy-to-clipboard needs a fallback for insecure contexts (the site is HTTPS, so fine) and a visible confirmation, not a silent write.

---

### 33. Work: turn the list into a career timeline

**What changes:** `components/ContentScreen.tsx:844-881` and `constants.tsx:124-184`. A thin vertical rail with year markers; the current role (Swan Bitcoin) at the top with an accent rule and a “Now” label; older roles collapsed to company + dates with an expand control for sub-roles; locations and periods in 12 px mono; company names linked where a URL exists; fix the 3.83:1 location colour. Show the sub-roles as indented steps on the rail rather than a second list.

**Why:** Eight identical cards do not show progression or recency; the current role is visually the same as a 2014 role. The screen is called Work/History but reads as a flat table. A timeline is the natural PS2 “system configuration” metaphor (rows, rules, one selected row) and is easier to scan.

**Guide:** PS2 system configuration reference (ruled rows, selected row); Laws of UX: serial position (first/last matter) and Hick's Law; Family Values: gradual revelation (collapse older detail); WCAG 2.2 SC 1.4.3.

**Mobile / desktop:** Mobile: one column, current role expanded, older roles collapsed. Desktop: the rail on the left, dates on the right, details in a 60ch column.

**Effort / risk:** S–M / low. No new data needed; the type already supports sub-roles.

---

### 34. Portfolio / Projects: one link per project, in a PS2 file-browser row

**What changes:** `components/ContentScreen.tsx:571-620`. Replace the three cards with a list of project rows (or a 2-column grid at desktop) that read like a system browser: year, title, role, a one-line description, tech tags, and a single external affordance. One anchor per row; remove the nested icon anchor and the absolute overlay. Add a selected/hover row treatment and a focus ring; show the year as tabular mono. Keep the descriptions but clamp to two lines with a “more” reveal on the selected row.

**Why:** The current cards have two links to the same URL (one covered by the overlay), so keyboard users get duplicate stops and pointer users cannot click the icon; the card also has no selection state. A row-based browser matches the PS2 reference and makes the three projects scannable.

**Guide:** PS2 browser/file list reference; Stage Show: quiet hierarchy and real strings where the eye lands; WCAG 2.2 SC 2.4.4 (link purpose) and 2.4.7.

**Mobile / desktop:** Mobile: stacked rows with the external arrow always visible. Desktop: 2-column rows or a compact table with a selected row.

**Effort / risk:** S / low. One component, no data change.

---

### 35. Portfolio / Investments and Design: accessible table, real lightbox

**What changes:** `components/ContentScreen.tsx:469-530`. Investments: add `<caption>`, `scope="col"` on headers, a responsive list layout under 480 px, status as icon + text (not colour alone), and sortable columns if the data grows. Design: keep the 2-column mobile grid but make each figure a button that opens a dialog lightbox with the full image, title, type, and alt text; keyboard: Enter/Space opens, Escape closes, arrows move, focus returns; use a larger rendition in the lightbox. Remove the hover-only border as the only state.

**Why:** The table has no header semantics and 16 px cell padding squeezes the asset name to ~92 px at 390; status is a coloured pill. The design grid is a set of static images with no way to see the work at size — a portfolio that cannot zoom its logos is not showing the work.

**Guide:** WCAG 2.2 SC 1.3.1 (tables), 1.4.1 (colour), 2.1.1 (keyboard); WAI-ARIA APG: Dialog; Apple HIG: Photos (zoom and dismiss); Stage Show: the image is the focal object, give it the frame.

**Mobile / desktop:** Mobile needs the list/stacked table and a full-screen lightbox; desktop can keep the table and a centred lightbox with arrow keys.

**Effort / risk:** M / low–medium. The lightbox is a new component; reuse the dialog/focus trap from item 15.

---

### 36. Book: make it the one physical object in the system

**What changes:** `components/ContentScreen.tsx:624-682`, `constants.tsx:110-121`. Replace the flat cover + text card with a PS2-style product panel: a 3D-ish book cover (perspective, a spine highlight, a soft ground shadow), the title in the display face (no serif), the subtitle in mono, a short excerpt, a 5-star rating rendered as original glyphs, and one 44 px “Get the book” button with an external-link cue. Add the affiliate disclosure in 12 px secondary text. Optimise the cover (item 12), add `width`/`height`/`loading`, and give the whole panel one link or one button (not both a focusable card and a button). Add a “Read an excerpt” expansion if there is sample text.

**Why:** Book is a rare, high-emotion screen — the Delight-Impact Curve says spend here — but it currently uses a serif title, a rotated square image, a 38 px button, and a card that is focusable with no role. It looks like a different site from the rest of the system.

**Guide:** Family Values: Delight through selective emphasis (rare screen, higher intensity); PS2 memory-card/product panel reference; WCAG 2.2 SC 2.5.8 and 4.1.2; web.dev: image formats.

**Mobile / desktop:** Mobile: cover 200–240 px wide, title and CTA below; desktop: cover left, copy right, with more negative space.

**Effort / risk:** S–M / low. The main cost is the cover rendition; the layout is one component.

---

## 12. Media tabs

### 37. Give each Content tab its own shape instead of one repeated card

**What changes:** `components/ContentScreen.tsx:799-841`, `data/media.ts`, `data/posts.ts`.

- **Essays:** a featured essay at the top (most recent/longest), then a compact index with date and read time; keep the 15 items but make the first one visually dominant.
- **Posts:** two columns at desktop, one at mobile; show the tweet text, date, likes/replies/quotes (the data has them), and a lazy thumbnail with an aspect box; cap at 20 with “Show more.”
- **Podcasts:** split “Host — Value Stack” and “Guest appearances”; group episodes by year, show the count, and make the most recent episode a larger row with a play affordance (open YouTube in a new tab; do not autoplay).
- **Lectures:** group by year and venue, show the count, and use a compact row with a small play glyph; the current page is a flat list of identical links. Consider one inline `youtube-nocookie` player for the selected lecture, loaded on click.
- **Tutorials:** add a format/length badge (“video”, “guide”) and a one-line outcome.
- **Reading:** group by theme or year; show author + date on one line; persistent external cue.

Add an empty state for each (“No lectures for 2023 yet.”) and a shared count line.

**Why:** Every tab currently renders the same `renderMediaCard` rectangle, so Posts, Podcasts, Lectures, Tutorials, and Reading are visually indistinguishable aside from their headings. The lectures data is the most list-like and the most in need of grouping; the posts data has engagement fields that are never used. Distinct shapes help recognition and make the hub feel authored rather than generated.

**Guide:** Stage Show: “a budget for words, not elements” and real strings where the story is; Laws of UX: Hick's Law and recognition over recall; Family Values: Simplicity (grouping) and Delight (one featured item per tab); PS2 browser reference (lists with metadata, not cards everywhere).

**Mobile / desktop:** Mobile: one column, bottom sheets for filters, 44 px rows. Desktop: two columns for posts, a year-grouped list for podcasts/lectures, and a denser index for essays.

**Effort / risk:** M / medium. The data is already there; the risk is over-designing. Ship one distinctive tab first (Lectures) and reuse the pattern.

---

## 13. States, errors, and metadata

### 38. Design the states the site currently lacks: loading, empty, error, 404, offline

**What changes:** `components/ContentScreen.tsx:894` (remove the unstyled “Under Construction”), `:719-841` (empty lists), new `components/EmptyState.tsx`, `components/ErrorBoundary.tsx`, `components/Skeleton.tsx`, `public/404.html`. Add: a skeleton at the final geometry for lazy images and split screens (Stage Show's loading example is the model); a designed empty state per list (“No essays match ‘custody’” with a clear filter reset); an error boundary with a retry and a short explanation; a branded 404 that offers the menu; an offline state using the existing fog and a “Reconnect” line. Add `aria-live` for async results and `role="status"` for the boot/loading messages.

**Why:** Today an unknown section renders an unstyled div, an empty filter would render blank, an image failure leaves a hole, a bad URL shows GitHub's 404, and a runtime error would blank the app. A system UI is judged by its least-used corners (Family Values' “fancy restaurant with a dirty bathroom”). This is also where a small amount of delight belongs without becoming noise.

**Guide:** Family Values: consistent polish everywhere and Delight through selective emphasis (rare states); Stage Show: the loading example (skeleton at the content's own geometry); Nielsen Norman: help users recognize, diagnose, and recover from errors; WCAG 2.2 SC 4.1.3 (status messages).

**Mobile / desktop:** Both. Keep the 404 and empty states within the same shell (header, help bar) so they do not feel like a different site.

**Effort / risk:** S–M / low. The skeleton must match the final layout or it becomes a second layout shift; measure CLS after adding it.

---

### 39. Fix titles, metadata, analytics, and add a performance budget

**What changes:** `index.html:7`, `:15-31`, `:35`; `components/App.tsx:30-37`; `components/ContentScreen.tsx:239-247`; new `public/robots.txt`, `public/sitemap.xml` (generated). Set per-route titles/descriptions/canonicals/OG; add `Article` JSON-LD for essays and `Person` for the site. Fix Umami: use `data-auto-pageview="false"` instead of `data-auto-track="false"`, verify the website id, and send explicit pageviews; today every beacon returns 400 “Website not found.” Add a Lighthouse/Core Web Vitals budget in CI: LCP < 2.5 s, CLS < 0.1, INP < 200 ms, initial JS < 150 KB gzip (before splitting), no console errors/warnings. Measure the boot separately.

**Why:** The site currently has one title, one canonical, one OG card, no sitemap, and an analytics pipeline that fails silently in the console. A personal site's essays need to be findable and shareable; the stated performance target needs a number and a gate. Without a budget, the 407 KB CDN and 461 KB chunk will return.

**Guide:** web.dev: Core Web Vitals, SEO, and structured data; WCAG 2.2 SC 2.4.2 (page titled); Family Values: table stakes (utility and performance); Doherty threshold (perceived speed).

**Mobile / desktop:** Both. Run the budget on a throttled mobile profile; desktop is not the constraint.

**Effort / risk:** S–M / low. Analytics is third-party and may need an account-side fix; if it cannot be fixed, remove the script rather than shipping a console error.

---

## 4. Suggested sequence

If the work is split into releases, this order preserves the most value with the least rework:

1. **Release A — make it work:** items 1, 2, 4, 5, 6, 7, 10, 11, 13, 14, 15, 19. Boot, audio, haptics, Tailwind, splitting, routing, focus. This is the difference between a demo and a site.
2. **Release B — make it legible:** items 3, 8, 9, 16, 17, 18, 20, 21, 22, 23, 25, 26, 29, 30. The PS2 system composition, the type/contrast pass, the menu, tabs, and reader.
3. **Release C — make it complete:** items 12, 24, 27, 28, 31–39. Content shape, screens, states, metadata, and measurement.

Do not ship a new sound before the interaction bus (item 5) and the settings (item 8); otherwise the inconsistency will be rebuilt into the new palette. Do not ship the reader redesign before routing (item 14), or the “copy link” and share affordances will have nothing to point at.
