import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const SITE = 'https://justsaybits.org';
const OG_IMAGE = `${SITE}/og-image.jpg`;
const OG_IMAGE_ALT =
  'Pencil sketch portrait of Zach Wischler beside the text: Personal website, Zach Wischler, author of The Bitcoin Tao.';

interface EssayMeta {
  title: string;
  date: string;
  readTime: string;
  excerpt: string;
  slug: string;
}

const readEssays = (): EssayMeta[] => {
  const source = fs.readFileSync(path.resolve(__dirname, 'data/essays.ts'), 'utf8');
  const declaration = source.indexOf('export const ESSAYS');
  const assign = source.indexOf('=', declaration);
  const start = source.indexOf('[', assign);
  const end = source.lastIndexOf(']');
  if (declaration < 0 || assign < 0 || start < 0 || end < start) return [];
  return JSON.parse(source.slice(start, end + 1)) as EssayMeta[];
};

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const isoDate = (value: string): string | null => {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
};

const metaTag = (attribute: 'name' | 'property', key: string, value: string): string =>
  `<meta ${attribute}="${key}" content="${escapeHtml(value)}">`;

const replaceMeta = (html: string, attribute: 'name' | 'property', key: string, value: string): string => {
  const pattern = new RegExp(`<meta ${attribute}="${key}" content="[^"]*"\\s*/?>`);
  return pattern.test(html)
    ? html.replace(pattern, metaTag(attribute, key, value))
    : html.replace('</head>', `  ${metaTag(attribute, key, value)}\n  </head>`);
};

const injectEssayShell = (template: string, essay: EssayMeta, url: string): string => {
  const published = isoDate(essay.date);
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: essay.title,
    description: essay.excerpt,
    ...(published ? { datePublished: published, dateModified: published } : {}),
    url,
    mainEntityOfPage: url,
    image: OG_IMAGE,
    author: { '@type': 'Person', name: 'Zach Wischler', url: SITE },
    publisher: { '@type': 'Person', name: 'Zach Wischler', url: SITE },
  }).replace(/</g, '\\u003c');

  let html = template;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(`${essay.title} | Zach Wischler`)}</title>`);
  html = html.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${url}">`,
  );
  html = replaceMeta(html, 'name', 'description', essay.excerpt);
  html = replaceMeta(html, 'property', 'og:title', `${essay.title} | Zach Wischler`);
  html = replaceMeta(html, 'property', 'og:description', essay.excerpt);
  html = replaceMeta(html, 'property', 'og:url', url);
  html = replaceMeta(html, 'property', 'og:type', 'article');
  html = replaceMeta(html, 'property', 'og:image', OG_IMAGE);
  html = replaceMeta(html, 'property', 'og:image:alt', OG_IMAGE_ALT);
  html = replaceMeta(html, 'name', 'twitter:title', `${essay.title} | Zach Wischler`);
  html = replaceMeta(html, 'name', 'twitter:description', essay.excerpt);
  html = replaceMeta(html, 'name', 'twitter:image', OG_IMAGE);
  if (published) {
    html = replaceMeta(html, 'property', 'article:published_time', published);
  }
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
  return html;
};

/**
 * GitHub Pages can serve static files but cannot rewrite paths. Emit a real
 * HTML shell per essay so crawlers and link unfurlers see the essay's title,
 * excerpt, canonical, OG tags, and Article JSON-LD before the app boots.
 */
const staticPagesPlugin = (): Plugin => ({
  name: 'jsb-static-pages',
  apply: 'build',
  closeBundle() {
    const dist = path.resolve(__dirname, 'dist');
    const indexFile = path.join(dist, 'index.html');
    if (!fs.existsSync(indexFile)) return;

    const template = fs.readFileSync(indexFile, 'utf8');
    const essays = readEssays();
    const buildDate = new Date().toISOString().slice(0, 10);

    const pages: { path: string; lastmod?: string; priority: string }[] = [
      { path: '/', lastmod: buildDate, priority: '1.0' },
      { path: '/about', lastmod: buildDate, priority: '0.8' },
      { path: '/social', lastmod: buildDate, priority: '0.7' },
      { path: '/work', lastmod: buildDate, priority: '0.8' },
      { path: '/portfolio', lastmod: buildDate, priority: '0.7' },
      { path: '/portfolio/investments', lastmod: buildDate, priority: '0.5' },
      { path: '/portfolio/design', lastmod: buildDate, priority: '0.5' },
      { path: '/book', lastmod: buildDate, priority: '0.8' },
      { path: '/content/essays', lastmod: buildDate, priority: '0.9' },
      { path: '/content/posts', lastmod: buildDate, priority: '0.6' },
      { path: '/content/podcasts', lastmod: buildDate, priority: '0.6' },
      { path: '/content/lectures', lastmod: buildDate, priority: '0.6' },
      { path: '/content/tutorials', lastmod: buildDate, priority: '0.5' },
      { path: '/content/reading', lastmod: buildDate, priority: '0.5' },
    ];

    for (const essay of essays) {
      const route = `/content/essays/${essay.slug}/`;
      const url = `${SITE}${route}`;
      const published = isoDate(essay.date);
      pages.push({ path: route, lastmod: published?.slice(0, 10), priority: '0.8' });

      const dir = path.join(dist, 'content', 'essays', essay.slug);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), injectEssayShell(template, essay, url), 'utf8');
    }

    const urlEntries = pages.map(page => [
      '  <url>',
      `    <loc>${SITE}${page.path}</loc>`,
      page.lastmod ? `    <lastmod>${page.lastmod}</lastmod>` : null,
      `    <priority>${page.priority}</priority>`,
      '  </url>',
    ].filter(Boolean).join('\n')).join('\n');

    fs.writeFileSync(
      path.join(dist, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`,
      'utf8',
    );
    fs.writeFileSync(
      path.join(dist, 'robots.txt'),
      `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`,
      'utf8',
    );
  },
});

export default defineConfig(() => {
    return {
      base: '/', // Custom domain (justsaybits.org) requires base path of '/'
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), staticPagesPlugin()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
