#!/usr/bin/env node
/**
 * Dependency-free production budget gate.
 * Reads the built site, not the source, so it measures what ships.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DIST = path.resolve('dist');
const KB = 1024;
const BUDGET = {
  initialJs: 150 * KB,
  initialCss: 25 * KB,
  image: 320 * KB,
};
const FORBIDDEN = ['cloud.umami.is', 'cdn.tailwindcss.com'];

const fail = [];
const warn = [];
const pass = [];

const read = (file) => fs.readFileSync(file);
const gzipSize = (file) => zlib.gzipSync(read(file), { level: 9 }).length;

const check = (condition, message) => {
  if (condition) pass.push(message);
  else fail.push(message);
};

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/index.html is missing. Run `npm run build` first.');
  process.exit(1);
}

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const htmlBytes = Buffer.byteLength(html);

const assetRefs = (pattern) =>
  Array.from(html.matchAll(pattern), (match) => match[1])
    .map((src) => src.replace(/^\//, ''))
    .filter((src) => src.startsWith('assets/'));

const initialScripts = assetRefs(/<script[^>]+src="([^"]+)"/g);
const preloads = assetRefs(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g);
const initialStyles = assetRefs(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g);

const unique = (items) => [...new Set(items)];
const missing = unique([...initialScripts, ...preloads, ...initialStyles])
  .filter((src) => !fs.existsSync(path.join(DIST, src)));

if (missing.length) {
  fail.push(`missing initial assets: ${missing.join(', ')}`);
}

const jsBytes = unique([...initialScripts, ...preloads])
  .filter((src) => fs.existsSync(path.join(DIST, src)))
  .reduce((total, src) => total + gzipSize(path.join(DIST, src)), 0);
const cssBytes = unique(initialStyles)
  .filter((src) => fs.existsSync(path.join(DIST, src)))
  .reduce((total, src) => total + gzipSize(path.join(DIST, src)), 0);

check(
  jsBytes <= BUDGET.initialJs,
  `initial JS ${(jsBytes / KB).toFixed(1)} KB gzip (budget ${BUDGET.initialJs / KB} KB)`,
);
check(
  cssBytes <= BUDGET.initialCss,
  `initial CSS ${(cssBytes / KB).toFixed(1)} KB gzip (budget ${BUDGET.initialCss / KB} KB)`,
);

const forbidden = FORBIDDEN.filter((host) => html.includes(host));
check(forbidden.length === 0, `no third-party runtime scripts${forbidden.length ? `: ${forbidden.join(', ')}` : ''}`);

const hasPerson = html.includes('"@type": "Person"') || html.includes('"@type":"Person"');
check(hasPerson, 'Person JSON-LD present in the document head');
check(fs.existsSync(path.join(DIST, 'robots.txt')), 'robots.txt emitted');
check(fs.existsSync(path.join(DIST, 'sitemap.xml')), 'sitemap.xml emitted');

// Large rasters are the usual cause of a slow first screen; HTML is excluded.
const STALE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.ico']);
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

const largeImages = walk(DIST)
  .filter((file) => STALE_EXT.has(path.extname(file).toLowerCase()))
  .map((file) => ({ file, size: fs.statSync(file).size }))
  .filter(({ size }) => size > BUDGET.image);

check(
  largeImages.length === 0,
  largeImages.length
    ? `images over ${BUDGET.image / KB} KB: ${largeImages.map(({ file }) => path.relative(DIST, file)).join(', ')}`
    : `no raster over ${BUDGET.image / KB} KB`,
);

if (htmlBytes > 120 * KB) {
  warn.push(`index.html is ${(htmlBytes / KB).toFixed(1)} KB; inline boot/CSS adds to every response`);
}

for (const line of pass) console.log(`PASS  ${line}`);
for (const line of warn) console.log(`WARN  ${line}`);
for (const line of fail) console.error(`FAIL  ${line}`);

if (fail.length) {
  console.error(`\n${fail.length} budget check(s) failed.`);
  process.exit(1);
}

console.log('\nAll performance budget checks passed.');
