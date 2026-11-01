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
