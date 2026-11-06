/**
 * Liveline has no prop to hide the dashed live-price guide. `grid={false}` only
 * removes Y-axis grid lines. Flip the drawLine default so our header sparkline
 * stays clean. Idempotent — safe to re-run on every install.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const before = 'skipDashLine = false';
const after = 'skipDashLine = true';
const targets = ['index.js', 'index.cjs'].map((name) =>
  path.join(root, 'node_modules', 'liveline', 'dist', name),
);

if (!targets.some((t) => fs.existsSync(t))) {
  console.warn('[patch-liveline] liveline not installed; skip');
  process.exit(0);
}

let patched = 0;
for (const target of targets) {
  if (!fs.existsSync(target)) continue;
  const source = fs.readFileSync(target, 'utf8');
  if (source.includes(after) && !source.includes(before)) {
    console.log(`[patch-liveline] already patched ${path.basename(target)}`);
    continue;
  }
  if (!source.includes(before)) {
    console.warn(`[patch-liveline] expected default not found in ${path.basename(target)}; skip`);
    continue;
  }
  fs.writeFileSync(target, source.replaceAll(before, after));
  patched += 1;
  console.log(`[patch-liveline] disabled dash guide in ${path.basename(target)}`);
}

if (patched === 0) {
  console.log('[patch-liveline] nothing to do');
}
