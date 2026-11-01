# Performance budget

The target is a fast first paint on a throttled mobile connection, a stable
layout through boot and every screen, and a small initial JavaScript payload.
Measure the menu/boot path separately from the essay and content screens: the
boot gate is deliberately interactive, so its LCP and INP include time spent
waiting for a key press.

## Budget

| Metric | Budget | How it is measured |
| --- | --- | --- |
| LCP | < 2.5 s | Lighthouse mobile, simulated Slow 4G, 3 runs, median |
| CLS | < 0.1 | Lighthouse mobile and the `layout-shift` PerformanceObserver |
| INP | < 200 ms | Field data, or DevTools Performance while opening a screen and a lightbox |
| Initial JS | < 150 KB gzip | `npm run budget` (entry script and modulepreloads in `dist/index.html`) |
| Initial CSS | < 25 KB gzip | `npm run budget` |
| Console | No errors or warnings | Browser console on `/`, `/about`, `/portfolio`, `/content/essays`, and an essay route |
| Images | No raster over 320 KB | `npm run budget` |

The initial-JS budget covers the entry chunk before route/data splitting. Lazy
screen and essay chunks are reported by the build and are not part of the
first-paint budget.

## Local checks

Run a production build, then the budget script:

```sh
npm run build
npm run budget
```

The script fails with a non-zero exit code when a budget is exceeded, when a
forbidden third-party script is present, or when the sitemap/robots or Person
JSON-LD is missing. It is intentionally dependency-free and safe to add to CI
before the deploy step.

Measure Core Web Vitals against the built site with Lighthouse's throttled
mobile profile:

```sh
npx lighthouse https://justsaybits.org/ \
  --preset=desktop --only-categories=performance --view
```

Use the mobile default preset for the gate (omit `--preset=desktop`). Run each
URL three times and compare the median to the budget. For INP, use the
Performance panel while opening About, Work, Portfolio, and the Design
lightbox; the synthesised sounds and boot scene must not create long tasks.

## CI gate

The bundle portion already fits in a normal CI job:

```yaml
- run: npm ci
- run: npm run build
- run: npm run budget
```

For the field/lab metrics, add Lighthouse CI with assertions for
`largest-contentful-paint` (2500 ms), `cumulative-layout-shift` (0.1), and
`total-blocking-time` (200 ms as the lab proxy for INP), plus a custom browser
run that fails on console errors or warnings. Keep the boot/menu URL and one
content URL as separate assertions so the interactive boot gate does not hide
a regression on the reading screens.

## Measured: design pass before and after

Lighthouse 13.6.0, mobile default preset (simulated Slow 4G, 4× CPU
throttling), headless Chrome, performance category only. Both sides ran
against `vite preview` of this branch: the before build at `localhost:4301`
and the after build at `localhost:4311`. The after build ran twice; the table
shows the two results where they differ.

| Metric | Before | After | Budget | Result |
| --- | --- | --- | --- | --- |
| Performance score | 78 | 98 | — | +20 |
| First Contentful Paint | 2.7 s | 1.5 s | — | −1.2 s |
| Largest Contentful Paint | 3.5 s | 2.2 s / 2.1 s | < 2.5 s | Pass |
| Cumulative Layout Shift | 0 | 0 | < 0.1 | Pass |
| Total Blocking Time | 270 ms | 0 ms | < 200 ms | Pass |
| Speed Index | 4.5 s | 1.5 s | — | −3.0 s |
| Time to Interactive | 3.7 s | 2.2 s / 2.1 s | — | −1.5 s |
| Total transfer | 382 KiB | 290 KiB | — | −92 KiB |

The gain comes from the single committed blue type/colour system, the PS2
system-menu fonts loading only the weights in use, deferring sound and haptic
setup until a user gesture, and dropping the unused runtime fetches. CLS stays
at 0 because the boot gate and every screen reserve their final layout before
the first paint.

`npm run budget` passes on the after build: initial JS 104.5 KB gzip (150 KB),
initial CSS 13.7 KB gzip (25 KB), no third-party runtime scripts, Person
JSON-LD and the sitemap/robots present, and no raster over 320 KB.

The 36 review screenshots in `docs/screenshots/` were compressed losslessly
with `oxipng -o 4 --strip safe`; the eleven files over 400 KB before
compression dropped 16–56%.
