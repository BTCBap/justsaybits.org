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
