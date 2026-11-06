/**
 * Liveline has no props for a few header-sparkline chrome bits we want gone.
 * `grid={false}` only removes Y-axis grid lines; the dashed live-price guide,
 * X-axis time labels, and the baseline axis line still draw. Flip those
 * defaults / early-return so the header sparkline stays clean. Idempotent —
 * safe to re-run on every install.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['index.js', 'index.cjs'].map((name) =>
  path.join(root, 'node_modules', 'liveline', 'dist', name),
);

/** @type {Array<{ name: string; before: string; after: string }>} */
const patches = [
  // Softer loading → live morph (Family Values continuity). Defaults are
  // 0.09 fwd / 0.14 alpha — a touch abrupt after a cold boot.
  {
    name: 'reveal speed fwd',
    before: 'var CHART_REVEAL_SPEED_FWD = 0.09',
    after: 'var CHART_REVEAL_SPEED_FWD = 0.045',
  },
  {
    name: 'loading alpha speed',
    before: 'var LOADING_ALPHA_SPEED = 0.14',
    after: 'var LOADING_ALPHA_SPEED = 0.07',
  },

  // Liveline only lerps its smoothed value inside the has-data branch, so a
  // boot spent in `loading` leaves it at the mount value (0). On reveal the
  // tip and Y-range then sweep up from $0 — the abrupt first morph. Snap to
  // the live value whenever the range is (re)initialising.
  {
    name: 'reveal value snap',
    before: 'const effectivePoints = useStash ? lastDataRef.current : points;',
    after:
      'const effectivePoints = useStash ? lastDataRef.current : points; if (!rangeInitedRef.current && !useStash) displayValueRef.current = cfg.value;',
  },
  // Morph stroke starts grey (gridLabel) while the loading wave is drawn in
  // the line colour — a colour flash on the first live frame. Keep the line
  // colour through the morph so wave → line is one continuous stroke.
  {
    name: 'reveal stroke colour',
    before: 'blendColor(palette.gridLabel, palette.line, colorT)',
    after: 'blendColor(palette.line, palette.line, colorT)',
  },

  // Y-range floor of ~0.02% of price (~$20 on BTC). With `exaggerate`, a $1
  // tick after a flat boot seed filled the full height — a cliff on the first
  // live move. Keeps sub-$20 jitter as gentle wiggle.
  {
    name: 'min price range',
    before: 'const minRange = rawRange * (exaggerate ? 0.02 : 0.1) || (exaggerate ? 0.04 : 0.4);',
    after:
      'const minRange = Math.max(rawRange * (exaggerate ? 0.02 : 0.1) || (exaggerate ? 0.04 : 0.4), Math.abs(targetMax) * 2e-4);',
  },

  {
    name: 'dash guide',
    before: 'skipDashLine = false',
    after: 'skipDashLine = true',
  },
  // No-op the time axis (baseline + tick labels like 21:10:00). Keep the
  // function signature so call sites stay valid.
  {
    name: 'time axis',
    before:
      'function drawTimeAxis(ctx, layout, palette, windowSecs, targetWindowSecs, formatTime, state, dt) {',
    after:
      'function drawTimeAxis(ctx, layout, palette, windowSecs, targetWindowSecs, formatTime, state, dt) { return;',
  },
];

if (!targets.some((t) => fs.existsSync(t))) {
  console.warn('[patch-liveline] liveline not installed; skip');
  process.exit(0);
}

let patched = 0;
for (const target of targets) {
  if (!fs.existsSync(target)) continue;
  let source = fs.readFileSync(target, 'utf8');
  let changed = false;
  for (const patch of patches) {
    // `after` may contain `before` (prefix patches) — check `after` first.
    if (source.includes(patch.after)) {
      console.log(`[patch-liveline] already patched ${patch.name} in ${path.basename(target)}`);
      continue;
    }
    if (!source.includes(patch.before)) {
      console.warn(
        `[patch-liveline] expected ${patch.name} pattern not found in ${path.basename(target)}; skip`,
      );
      continue;
    }
    source = source.replaceAll(patch.before, patch.after);
    changed = true;
    console.log(`[patch-liveline] applied ${patch.name} in ${path.basename(target)}`);
  }
  if (changed) {
    fs.writeFileSync(target, source);
    patched += 1;
  }
}

if (patched === 0) {
  console.log('[patch-liveline] nothing to do');
}
