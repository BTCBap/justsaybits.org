import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Static page generation, sitemap and robots live in the post-build step
 * `scripts/prerender-routes.mjs` so the route list and metadata have one home
 * (`utils/site-routes.mjs`), shared with the router.
 */

/**
 * `vite preview` falls back to the SPA root for extensionless paths. GitHub
 * Pages serves the directory index instead, so preview does the same: a built
 * `dist/<path>/index.html` is what a deep link gets in production.
 */
const directoryIndexPreview = (): Plugin => {
  let distDir = '';
  return {
    name: 'jsb-directory-index-preview',
    apply: 'serve',
    configResolved(config) {
      distDir = path.resolve(config.root, config.build.outDir);
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        const pathname = (req.url ?? '/').split('?')[0];
        if (!pathname.startsWith('/') || pathname === '/' || pathname.endsWith('/')) return next();
        if (pathname.includes('..') || path.extname(pathname) !== '') return next();
        if (fs.existsSync(path.join(distDir, pathname, 'index.html'))) {
          req.url = `${pathname}/index.html`;
        }
        next();
      });
    },
  };
};

export default defineConfig(() => ({
  base: '/', // Custom domain (justsaybits.org) requires base path of '/'
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react(), directoryIndexPreview()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
}));
