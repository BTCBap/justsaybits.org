/**
 * Pure route manifest and metadata shared by the browser router and the
 * post-build prerender script. No DOM, React or Node APIs live here so both
 * runtimes can import the same source of truth.
 */

export const SITE = 'https://justsaybits.org';
export const DEFAULT_IMAGE = `${SITE}/og-image.jpg`;
export const DEFAULT_IMAGE_ALT = 'Pencil sketch portrait of Zach Wischler beside the text: Personal website, Zach Wischler, author of The Bitcoin Tao.';
export const HOME_DESCRIPTION =
  'The personal website of Zach Wischler, author of The Bitcoin Tao. Essays, talks and media, dedicated to advancing individual sovereignty through cryptography.';

/** @type {readonly ['essays', 'posts', 'podcasts', 'lectures', 'tutorials', 'reading']} */
export const CONTENT_TAB_IDS = ['essays', 'posts', 'podcasts', 'lectures', 'tutorials', 'reading'];
/** @type {readonly ['projects', 'investments', 'design']} */
export const PORTFOLIO_TAB_IDS = ['projects', 'investments', 'design'];

export const SECTION_TITLES = {
  about: 'About',
  social: 'Social',
  work: 'Work',
  portfolio: 'Portfolio',
  book: 'Book',
  content: 'Content',
};

export const SECTION_DESCRIPTIONS = {
  about: 'Mission, core beliefs and current goals of Zach Wischler, author of The Bitcoin Tao.',
  social: 'Connect with Zach Wischler on X and LinkedIn, or send an email.',
  work: 'Career history across Swan Bitcoin, Casa, The Space Education Foundation, Personal Capital and Merrill Lynch.',
  portfolio: 'Projects, investments and design work by Zach Wischler.',
  book: 'The Bitcoin Tao: The Book of the Bitcoin Way and Its Virtue by Zach Wischler.',
  content: 'Essays, posts, podcasts, lectures, tutorials and reading from Zach Wischler.',
};

export const TAB_TITLES = {
  essays: 'Essays',
  posts: 'Posts',
  podcasts: 'Podcasts',
  lectures: 'Lectures',
  tutorials: 'Tutorials',
  reading: 'Reading',
  projects: 'Projects',
  investments: 'Investments',
  design: 'Design',
};

export const canonicalUrl = (path) => `${SITE}${path === '/' ? '/' : path}`;

export const essayPath = (slug) => `/content/essays/${encodeURIComponent(slug)}/`;

/** Title, description and OG type for a route; also drives the static pages. */
export const routeMeta = (route, essays = []) => {
  if (route.notFound) {
    return {
      title: 'Screen not found | justsaybits.org',
      description: 'That screen does not exist. Return to the main menu to keep browsing justsaybits.org.',
      type: 'website',
    };
  }
  if (!route.section) {
    return { title: 'Zach Wischler | Personal Website', description: HOME_DESCRIPTION, type: 'website' };
  }
  if (route.section === 'content' && route.slug) {
    const essay = essays.find(item => item.slug === route.slug);
    if (essay) {
      return {
        title: `${essay.title} | Zach Wischler`,
        description: essay.excerpt,
        type: 'article',
      };
    }
  }
  const sectionTitle = SECTION_TITLES[route.section] ?? 'justsaybits.org';
  const tabTitle = route.tab ? TAB_TITLES[route.tab] : null;
  const pageTitle = tabTitle ? `${sectionTitle} · ${tabTitle}` : sectionTitle;
  const description = route.tab
    ? `${tabTitle} on justsaybits.org. ${SECTION_DESCRIPTIONS[route.section] ?? HOME_DESCRIPTION}`
    : SECTION_DESCRIPTIONS[route.section] ?? HOME_DESCRIPTION;
  return {
    title: `${pageTitle} | Zach Wischler`,
    description,
    type: 'website',
  };
};

const isoDate = (value) => {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
};

const route = (path, section = null, tab = null, slug = null) => ({
  path,
  section,
  tab,
  slug,
  notFound: false,
});

/**
 * Every page the site serves, in sitemap order. `path` is the URL path; the
 * prerender script writes `dist/<path>/index.html` for each and the sitemap
 * uses `priority` and `lastmod`.
 */
export const prerenderRoutes = (essays = [], buildDate = new Date().toISOString().slice(0, 10)) => {
  const pages = [
    { ...route('/'), priority: '1.0', lastmod: buildDate },
    { ...route('/about', 'about'), priority: '0.8', lastmod: buildDate },
    { ...route('/social', 'social'), priority: '0.7', lastmod: buildDate },
    { ...route('/work', 'work'), priority: '0.8', lastmod: buildDate },
    { ...route('/portfolio', 'portfolio', 'projects'), priority: '0.7', lastmod: buildDate },
    { ...route('/portfolio/investments', 'portfolio', 'investments'), priority: '0.5', lastmod: buildDate },
    { ...route('/portfolio/design', 'portfolio', 'design'), priority: '0.5', lastmod: buildDate },
    { ...route('/book', 'book'), priority: '0.8', lastmod: buildDate },
    { ...route('/content/essays', 'content', 'essays'), priority: '0.9', lastmod: buildDate },
    { ...route('/content/posts', 'content', 'posts'), priority: '0.6', lastmod: buildDate },
    { ...route('/content/podcasts', 'content', 'podcasts'), priority: '0.6', lastmod: buildDate },
    { ...route('/content/lectures', 'content', 'lectures'), priority: '0.6', lastmod: buildDate },
    { ...route('/content/tutorials', 'content', 'tutorials'), priority: '0.5', lastmod: buildDate },
    { ...route('/content/reading', 'content', 'reading'), priority: '0.5', lastmod: buildDate },
  ];

  for (const essay of essays) {
    const published = isoDate(essay.date);
    pages.push({
      ...route(essayPath(essay.slug), 'content', 'essays', essay.slug),
      priority: '0.8',
      lastmod: published ? published.slice(0, 10) : buildDate,
    });
  }
  return pages;
};
