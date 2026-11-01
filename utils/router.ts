/**
 * A deliberately small History-API router. Each screen owns a path, the
 * document title and description follow the path, and browser Back/Forward
 * work because the same store listens to `popstate`.
 *
 * Paths:
 *   /                              menu
 *   /about /social /work /book     sections
 *   /portfolio[/investments|/design]
 *   /content/:tab                  essays | posts | podcasts | lectures |
 *                                  tutorials | reading
 *   /content/essays/:slug          essay reader
 *
 * GitHub Pages has no server rewrite. `public/404.html` stores the requested
 * path in session storage and redirects to `/`; `consumeRedirect()` restores
 * the path with `replaceState` before the first render, so a deep link behaves
 * like a normal entry.
 */

import { useSyncExternalStore } from 'react';
import { ESSAYS } from '../data/essays';
import {
  CONTENT_TAB_IDS,
  DEFAULT_IMAGE,
  DEFAULT_IMAGE_ALT,
  PORTFOLIO_TAB_IDS,
  SECTION_TITLES,
  SITE,
  canonicalUrl,
  essayPath,
  routeMeta as metaForRoute,
} from './site-routes.mjs';

export { CONTENT_TAB_IDS, PORTFOLIO_TAB_IDS, canonicalUrl };

export type ContentTabId = typeof CONTENT_TAB_IDS[number];
export type PortfolioTabId = typeof PORTFOLIO_TAB_IDS[number];

export interface Route {
  /** Canonical path for this screen. */
  path: string;
  section: string | null;
  tab: string | null;
  slug: string | null;
  notFound: boolean;
}

export type NavDirection = 'forward' | 'back';
export interface NavOrigin { x: number; y: number; }

export interface RouterState {
  route: Route;
  previous: Route | null;
  direction: NavDirection;
  /** Viewport point a section was opened from, for a container-transform feel. */
  origin: NavOrigin | null;
}

export interface NavigateOptions {
  replace?: boolean;
  direction?: NavDirection;
  origin?: NavOrigin | null;
}

const normalizePath = (path: string): string => {
  const [rawPath] = path.split(/[?#]/);
  let next = rawPath || '/';
  next = next.replace(/\/index\.html?$/i, '/');
  if (!next.startsWith('/')) next = `/${next}`;
  if (next.length > 1) next = next.replace(/\/+$/, '');
  return next;
};

const segmentList = (path: string): string[] =>
  normalizePath(path)
    .split('/')
    .filter(Boolean)
    .map(segment => {
      try {
        return decodeURIComponent(segment).toLowerCase();
      } catch {
        return segment.toLowerCase();
      }
    });

const notFound = (path: string): Route => ({
  path: normalizePath(path),
  section: null,
  tab: null,
  slug: null,
  notFound: true,
});

const sectionRoute = (
  section: string,
  tab: string | null,
  slug: string | null,
  path: string,
): Route => ({ path: normalizePath(path), section, tab, slug, notFound: false });

export const pathForSection = (section: string): string => {
  if (section === 'portfolio') return '/portfolio';
  if (section === 'content') return '/content/essays';
  return `/${section}`;
};

export const pathForTab = (section: string, tab: string): string => {
  if (section === 'content') {
    if (tab === 'essays' || !CONTENT_TAB_IDS.includes(tab as ContentTabId)) {
      return '/content/essays';
    }
    return `/content/${tab}`;
  }
  if (section === 'portfolio') {
    return tab === 'investments' || tab === 'design' ? `/portfolio/${tab}` : '/portfolio';
  }
  return pathForSection(section);
};

export const pathForEssay = (slug: string): string => essayPath(slug);

/** Browser URL for a route. Essay routes keep the slash of their static shell. */
const routeUrl = (route: Route): string =>
  route.section === 'content' && route.slug ? pathForEssay(route.slug) : route.path;

export const parseRoute = (input: string): Route => {
  const path = normalizePath(input);
  const segments = segmentList(path);
  if (segments.length === 0) {
    return { path: '/', section: null, tab: null, slug: null, notFound: false };
  }

  const [first, second, third] = segments;

  if (first === 'portfolio') {
    if (segments.length > 2) return notFound(path);
    if (!second || second === 'projects') {
      return sectionRoute('portfolio', 'projects', null, '/portfolio');
    }
    if (second === 'investments' || second === 'design') {
      return sectionRoute('portfolio', second, null, `/portfolio/${second}`);
    }
    return notFound(path);
  }

  if (first === 'content') {
    if (!second) return sectionRoute('content', 'essays', null, '/content/essays');
    if (second === 'essays') {
      if (segments.length > 3) return notFound(path);
      if (!third) return sectionRoute('content', 'essays', null, '/content/essays');
      const essay = ESSAYS.find(item => item.slug.toLowerCase() === third);
      if (!essay) return notFound(path);
      return sectionRoute('content', 'essays', essay.slug, pathForEssay(essay.slug));
    }
    if (segments.length === 2 && CONTENT_TAB_IDS.includes(second as ContentTabId)) {
      return sectionRoute('content', second, null, `/content/${second}`);
    }
    return notFound(path);
  }

  if (segments.length === 1 && SECTION_TITLES[first]) {
    return sectionRoute(first, null, null, pathForSection(first));
  }

  return notFound(path);
};

/** Page title and description for a route; also drives the static OG tags. */
export const routeMeta = (route: Route): { title: string; description: string; type: string } =>
  metaForRoute(route, ESSAYS);

const ensureMeta = (attribute: 'name' | 'property', key: string): HTMLMetaElement => {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  return element;
};

const ensureCanonical = (): HTMLLinkElement => {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }
  return element;
};

const ensureJsonLd = (): HTMLScriptElement => {
  let element = document.head.querySelector<HTMLScriptElement>('script#jsb-article-jsonld');
  if (!element) {
    element = document.createElement('script');
    element.type = 'application/ld+json';
    element.id = 'jsb-article-jsonld';
    document.head.appendChild(element);
  }
  return element;
};

const isoDate = (value: string): string | null => {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
};

export const applyRouteMeta = (route: Route): void => {
  if (typeof document === 'undefined') return;
  const meta = routeMeta(route);
  const url = canonicalUrl(routeUrl(route));
  document.title = meta.title;

  ensureMeta('name', 'description').content = meta.description;
  // A missing screen is not a canonical page: keep the URL out of the index
  // and leave the site root as the only canonical entry point.
  if (route.notFound) {
    document.head.querySelector('link[rel="canonical"]')?.remove();
    ensureMeta('name', 'robots').content = 'noindex';
  } else {
    document.head.querySelector('meta[name="robots"]')?.remove();
    ensureCanonical().href = url;
  }
  ensureMeta('property', 'og:title').content = meta.title;
  ensureMeta('property', 'og:description').content = meta.description;
  ensureMeta('property', 'og:url').content = route.notFound ? `${SITE}/` : url;
  ensureMeta('property', 'og:type').content = meta.type;
  ensureMeta('property', 'og:image').content = DEFAULT_IMAGE;
  ensureMeta('property', 'og:image:alt').content = DEFAULT_IMAGE_ALT;
  ensureMeta('name', 'twitter:card').content = 'summary_large_image';
  ensureMeta('name', 'twitter:title').content = meta.title;
  ensureMeta('name', 'twitter:description').content = meta.description;
  ensureMeta('name', 'twitter:image').content = DEFAULT_IMAGE;
  ensureMeta('name', 'twitter:image:alt').content = DEFAULT_IMAGE_ALT;

  const essay = route.section === 'content' && route.slug
    ? ESSAYS.find(item => item.slug === route.slug) ?? null
    : null;
  const published = essay ? isoDate(essay.date) : null;

  if (essay && published) {
    ensureMeta('property', 'article:published_time').content = published;
    ensureJsonLd().textContent = JSON.stringify({
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
    });
  } else {
    document.head.querySelector('meta[property="article:published_time"]')?.remove();
    document.head.querySelector('script#jsb-article-jsonld')?.remove();
  }
};

// --- redirect consumption (GitHub Pages 404 fallback) ----------------------

const REDIRECT_KEY = 'jsb.redirect';

const consumeRedirect = (): void => {
  try {
    const target = window.sessionStorage.getItem(REDIRECT_KEY);
    if (!target) return;
    window.sessionStorage.removeItem(REDIRECT_KEY);
    // Same-origin paths only; never follow a protocol-relative or absolute URL.
    if (target.startsWith('/') && !target.startsWith('//')) {
      window.history.replaceState(window.history.state, '', target);
    }
  } catch {
    // Private mode or a disabled store: the 404 page still links home.
  }
};

// --- store -----------------------------------------------------------------

interface HistoryState { __jsb?: number; }

const readIndex = (): number => {
  const state = window.history.state as HistoryState | null;
  return typeof state?.__jsb === 'number' ? state.__jsb : -1;
};

let currentIndex = 0;
let installed = false;

const buildInitialState = (): RouterState => {
  consumeRedirect();
  currentIndex = readIndex();
  if (currentIndex < 0) {
    currentIndex = 0;
    window.history.replaceState({ ...(window.history.state ?? {}), __jsb: 0 }, '', window.location.href);
  }
  const route = parseRoute(window.location.pathname);
  if (!route.notFound) {
    const path = routeUrl(route);
    if (window.location.pathname !== path) {
      const suffix = `${window.location.search}${window.location.hash}`;
      window.history.replaceState({ ...(window.history.state ?? {}), __jsb: currentIndex }, '', `${path}${suffix}`);
    }
  }
  return { route, previous: null, direction: 'forward', origin: null };
};

let state: RouterState = buildInitialState();
const listeners = new Set<() => void>();

const emit = (): void => listeners.forEach(listener => listener());

const commit = (route: Route, direction: NavDirection, origin: NavOrigin | null): void => {
  state = { route, previous: state.route, direction, origin };
  applyRouteMeta(route);
  emit();
};

const install = (): void => {
  if (installed) return;
  installed = true;
  try {
    window.history.scrollRestoration = 'manual';
  } catch {
    // Older Safari does not expose scrollRestoration; the app scrolls inner panes.
  }
  window.addEventListener('popstate', () => {
    const nextIndex = readIndex();
    if (nextIndex < 0) return; // leaving the site to the previous document
    const direction: NavDirection = nextIndex < currentIndex ? 'back' : 'forward';
    currentIndex = nextIndex;
    commit(parseRoute(window.location.pathname), direction, null);
  });
  applyRouteMeta(state.route);
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getState = (): RouterState => state;

export const navigate = (path: string, options: NavigateOptions = {}): void => {
  const target = normalizePath(path);
  const nextRoute = parseRoute(target);
  if (nextRoute.path === state.route.path) return;

  if (options.replace) {
    window.history.replaceState({ ...(window.history.state ?? {}), __jsb: currentIndex }, '', routeUrl(nextRoute));
  } else {
    currentIndex += 1;
    window.history.pushState({ ...(window.history.state ?? {}), __jsb: currentIndex }, '', routeUrl(nextRoute));
  }
  commit(nextRoute, options.direction ?? 'forward', options.origin ?? null);
};

/**
 * Close to a known parent route. When the visitor actually arrived from that
 * route, reuse the history entry so Back keeps working; otherwise replace the
 * current entry so a deep link does not push a dead end.
 */
export const closeTo = (path: string, direction: NavDirection = 'back'): void => {
  const target = normalizePath(path);
  if (state.previous?.path === target && currentIndex > 0) {
    window.history.back();
    return;
  }
  navigate(target, { replace: true, direction });
};

export const useRouter = (): RouterState => useSyncExternalStore(subscribe, getState, getState);

if (typeof window !== 'undefined') {
  install();
}
