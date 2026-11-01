#!/usr/bin/env node
/**
 * Post-build prerender. GitHub Pages serves files, not SPA rewrites, so every
 * known route gets its own `dist/<path>/index.html` copied from the built
 * index. Each copy carries the same title, description, canonical, OG and
 * Twitter tags the router applies at runtime, so deep links, crawlers and link
 * previews see the right page before JavaScript runs.
 *
 * The route list and metadata live in `utils/site-routes.mjs`, which the router
 * imports too; essay slugs come from `data/essays.ts`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_IMAGE,
  DEFAULT_IMAGE_ALT,
  SITE,
  canonicalUrl,
  prerenderRoutes,
  routeMeta,
} from '../utils/site-routes.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const INDEX = path.join(DIST, 'index.html');

/** ESSAYS is a plain JSON literal in data/essays.ts; read it without a TS runtime. */
const readEssays = () => {
  const source = fs.readFileSync(path.join(ROOT, 'data/essays.ts'), 'utf8');
  const declaration = source.indexOf('export const ESSAYS');
  const assign = source.indexOf('=', declaration);
  const start = source.indexOf('[', assign);
  const end = source.lastIndexOf(']');
  if (declaration < 0 || assign < 0 || start < 0 || end < start) {
    throw new Error('Could not read ESSAYS from data/essays.ts');
  }
  const essays = JSON.parse(source.slice(start, end + 1));
  for (const essay of essays) {
    if (!essay.slug || !essay.title || !essay.excerpt || !essay.date) {
      throw new Error(`Essay entry is missing slug/title/excerpt/date: ${JSON.stringify(essay)}`);
    }
  }
  return essays;
};

const escapeHtml = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const isoDate = (value) => {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
};

const metaTag = (attribute, key, value) =>
  `<meta ${attribute}="${key}" content="${escapeHtml(value)}">`;

/** Replace a meta tag in place, or add it before </head> when absent. */
const replaceMeta = (html, attribute, key, value) => {
  const pattern = new RegExp(`<meta ${attribute}="${key}" content="[^"]*"\\s*/?>`);
  return pattern.test(html)
    ? html.replace(pattern, metaTag(attribute, key, value))
    : html.replace('</head>', `  ${metaTag(attribute, key, value)}\n  </head>`);
};

const injectPage = (template, page, essays) => {
  const meta = routeMeta(page, essays);
  const url = canonicalUrl(page.path);
  const essay = page.slug ? essays.find(item => item.slug === page.slug) ?? null : null;
  const published = essay ? isoDate(essay.date) : null;

  let html = template;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(meta.title)}</title>`);
  html = html.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${url}">`,
  );
  html = replaceMeta(html, 'name', 'description', meta.description);
  html = replaceMeta(html, 'property', 'og:title', meta.title);
  html = replaceMeta(html, 'property', 'og:description', meta.description);
  html = replaceMeta(html, 'property', 'og:url', url);
  html = replaceMeta(html, 'property', 'og:type', meta.type);
  html = replaceMeta(html, 'property', 'og:image', DEFAULT_IMAGE);
  html = replaceMeta(html, 'property', 'og:image:alt', DEFAULT_IMAGE_ALT);
  html = replaceMeta(html, 'name', 'twitter:title', meta.title);
  html = replaceMeta(html, 'name', 'twitter:description', meta.description);
  html = replaceMeta(html, 'name', 'twitter:image', DEFAULT_IMAGE);
  html = replaceMeta(html, 'name', 'twitter:image:alt', DEFAULT_IMAGE_ALT);

  if (essay && published) {
    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: essay.title,
      description: essay.excerpt,
      datePublished: published,
      dateModified: published,
      url,
      mainEntityOfPage: url,
      image: DEFAULT_IMAGE,
      author: { '@type': 'Person', name: 'Zach Wischler', url: SITE },
      publisher: { '@type': 'Person', name: 'Zach Wischler', url: SITE },
    }).replace(/</g, '\\u003c');
    html = replaceMeta(html, 'property', 'article:published_time', published);
    html = html.replace(
      '</head>',
      `  <script type="application/ld+json" id="jsb-article-jsonld">${jsonLd}</script>\n  </head>`,
    );
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root"></div>\n<noscript><article><h1>${escapeHtml(essay.title)}</h1>`
        + `<p>${escapeHtml(essay.excerpt)}</p><p><a href="${SITE}/content/essays">All essays</a></p>`
        + '</article></noscript>',
    );
  }
  return html;
};

const writeSitemap = (pages) => {
  const urlEntries = pages.map(page => [
    '  <url>',
    `    <loc>${SITE}${page.path}</loc>`,
    page.lastmod ? `    <lastmod>${page.lastmod}</lastmod>` : null,
    `    <priority>${page.priority}</priority>`,
    '  </url>',
  ].filter(Boolean).join('\n')).join('\n');

  fs.writeFileSync(
    path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`,
    'utf8',
  );
};

const main = () => {
  if (!fs.existsSync(INDEX)) {
    console.error('dist/index.html is missing. Run `npm run build` first.');
    process.exit(1);
  }

  const template = fs.readFileSync(INDEX, 'utf8');
  const essays = readEssays();
  const buildDate = new Date().toISOString().slice(0, 10);
  const pages = prerenderRoutes(essays, buildDate);
  const written = [];

  for (const page of pages) {
    if (!page.path.startsWith('/') || page.path.includes('..')) {
      throw new Error(`Refusing to prerender unexpected path: ${page.path}`);
    }
    // The root route is the built index itself, not a copy of it.
    if (page.path === '/') {
      fs.writeFileSync(INDEX, injectPage(template, page, essays), 'utf8');
      written.push(page.path);
      continue;
    }
    const dir = path.join(DIST, page.path);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), injectPage(template, page, essays), 'utf8');
    written.push(page.path);
  }

  writeSitemap(pages);
  console.log(`prerendered ${written.length} routes and wrote sitemap.xml (${pages.length} URLs), robots.txt`);
};

main();
