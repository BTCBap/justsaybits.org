import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  LayoutGrid,
  TrendingUp,
  ExternalLink,
  FileText,
  Mic,
  GraduationCap,
  MonitorPlay,
  BookOpen,
  MessageCircle,
  PenTool,
} from 'lucide-react';
import { ESSAYS } from '../data/essays';
import { loadEssayContent } from '../data/essayContent';
import { Section, EssaySummary, MediaItem, ReadingItem, PostItem, ContentTab } from '../types';
import { interaction } from '../utils/Interaction';
import { announce } from '../utils/liveRegion';
import { usePrefersReducedMotion } from '../utils/preferences';
import { trapTabKey } from '../utils/focus';
import {
  CONTENT_TAB_IDS,
  PORTFOLIO_TAB_IDS,
  closeTo,
  navigate,
  pathForEssay,
  pathForTab,
  useRouter,
  type ContentTabId,
} from '../utils/router';
import HelpBar from './HelpBar';
import SystemToggles from './SystemToggles';
import Tabs, { tabId, tabPanelId } from './Tabs';
import { parseEssay } from './EssayBody';
import { EssayArticle, ReaderBar } from './EssayReader';
import AboutScreen from './screens/AboutScreen';
import SocialScreen from './screens/SocialScreen';
import WorkScreen from './screens/WorkScreen';
import BookScreen from './screens/BookScreen';
import { DesignTab, InvestmentsTab, ProjectsTab } from './screens/PortfolioScreen';
import EmptyState from './EmptyState';
import { ListSkeleton } from './Skeleton';
import {
  EssayRow,
  FeaturedEssay,
  MediaFeature,
  MediaRow,
  PostCard,
  ReadingRow,
  TutorialRow,
} from './ContentLists';

interface ContentScreenProps {
  section: Section;
  onBack: () => void;
  /** False while the boot gate owns the screen, so focus is not stolen behind it. */
  focusEnabled?: boolean;
}

const CLOSE_MS = 190;

const CONTENT_TABS: { id: ContentTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'essays', label: 'Essays', icon: FileText },
  { id: 'posts', label: 'Posts', icon: MessageCircle },
  { id: 'podcasts', label: 'Podcasts', icon: Mic },
  { id: 'lectures', label: 'Lectures', icon: GraduationCap },
  { id: 'tutorials', label: 'Tutorials', icon: MonitorPlay },
  { id: 'reading', label: 'Reading', icon: BookOpen },
];

const PORTFOLIO_TABS: { id: PortfolioTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'projects', label: 'Projects', icon: LayoutGrid },
  { id: 'investments', label: 'Investments', icon: TrendingUp },
  { id: 'design', label: 'Design', icon: PenTool },
];

const postEngagement = (p: PostItem) =>
  p.likes + p.reposts * 2 + p.replies + (p.quotes ?? 0) + (p.bookmarks ?? 0);

const yearOf = (date?: string): string => {
  const bce = date?.match(/\b(\d+)\s*BCE\b/i);
  if (bce) return `${bce[1]} BCE`;
  const match = date?.match(/\b(\d{4})\b/);
  return match ? match[1] : 'Undated';
};

const newestFirst = (a: { date?: string }, b: { date?: string }): number => {
  const aTime = a.date ? Date.parse(a.date) : NaN;
  const bTime = b.date ? Date.parse(b.date) : NaN;
  if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
  if (Number.isNaN(aTime)) return 1;
  if (Number.isNaN(bTime)) return -1;
  return bTime - aTime;
};

function groupByYear<T extends { date?: string }>(items: T[]): { year: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const year = yearOf(item.date);
    const bucket = groups.get(year);
    if (bucket) bucket.push(item);
    else groups.set(year, [item]);
  });
  return Array.from(groups, ([year, grouped]) => ({ year, items: grouped }))
    .sort((a, b) => {
      if (a.year === 'Undated') return 1;
      if (b.year === 'Undated') return -1;
      const rank = (year: string) => {
        const value = Number.parseInt(year, 10) || 0;
        return /BCE/i.test(year) ? -value : value;
      };
      return rank(b.year) - rank(a.year);
    });
}

function groupBySource<T extends { source?: string }>(items: T[]): { source: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const source = item.source || 'Other';
    const bucket = groups.get(source);
    if (bucket) bucket.push(item);
    else groups.set(source, [item]);
  });
  return Array.from(groups, ([source, grouped]) => ({ source, items: grouped }));
}

const CONTENT_TAB_META: Record<ContentTab, { noun: string }> = {
  essays: { noun: 'essays' },
  posts: { noun: 'posts' },
  podcasts: { noun: 'episodes' },
  lectures: { noun: 'lectures' },
  tutorials: { noun: 'tutorials' },
  reading: { noun: 'books and essays' },
};

interface MediaData {
  valueStack: MediaItem[];
  appearances: MediaItem[];
  lectures: MediaItem[];
  tutorials: MediaItem[];
  reading: ReadingItem[];
}

type PortfolioTab = 'projects' | 'investments' | 'design';

const ContentScreen: React.FC<ContentScreenProps> = ({ section, onBack, focusEnabled = true }) => {
  const { route, previous, origin } = useRouter();

  const contentTab: ContentTab = section.id === 'content'
    && CONTENT_TAB_IDS.includes(route.tab as ContentTabId)
    ? route.tab as ContentTab
    : 'essays';
  const portfolioTab: PortfolioTab = section.id === 'portfolio'
    && PORTFOLIO_TAB_IDS.includes(route.tab as PortfolioTab)
    ? route.tab as PortfolioTab
    : 'projects';
  const essaySlug = section.id === 'content' ? route.slug : null;
  const selectedEssay = essaySlug ? ESSAYS.find(essay => essay.slug === essaySlug) ?? null : null;

  const [essayContent, setEssayContent] = useState<string | null>(null);
  const [essayLoading, setEssayLoading] = useState(false);
  const [essayError, setEssayError] = useState(false);
  const [essayReload, setEssayReload] = useState(0);
  const [posts, setPosts] = useState<PostItem[] | null>(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [visiblePosts, setVisiblePosts] = useState(20);
  const [media, setMedia] = useState<MediaData | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [visibleMedia, setVisibleMedia] = useState(20);
  const [query, setQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [closing, setClosing] = useState(false);

  const reducedMotion = usePrefersReducedMotion();
  const bodyRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const essayTitleRef = useRef<HTMLHeadingElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const listScroll = useRef(0);
  const returnSlug = useRef<string | null>(null);
  const hadEssay = useRef(false);
  const lastEssaySlug = useRef<string | null>(null);
  const headingFocusDone = useRef(false);
  const closingTimer = useRef<number | null>(null);

  // Section entry: grow out of the selected menu card when there is one.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (!origin) {
      panel.style.transformOrigin = '';
      return;
    }
    const rect = panel.getBoundingClientRect();
    panel.style.transformOrigin = `${origin.x - rect.left}px ${origin.y - rect.top}px`;
  }, [origin, section.id]);

  // Move focus into the dialog once the boot gate has handed over the screen.
  useEffect(() => {
    if (!focusEnabled || headingFocusDone.current) return;
    headingFocusDone.current = true;
    if (essaySlug) return;
    const frame = requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [focusEnabled, essaySlug]);

  // Essay reader: start at the top (including when moving between essays),
  // focus the title, and put the reader back where they were on return.
  useEffect(() => {
    const body = bodyRef.current;
    if (essaySlug) {
      hadEssay.current = true;
      if (lastEssaySlug.current !== essaySlug) {
        lastEssaySlug.current = essaySlug;
        body?.scrollTo({ top: 0 });
      }
      if (!focusEnabled) return;
      const frame = requestAnimationFrame(() => essayTitleRef.current?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(frame);
    }
    lastEssaySlug.current = null;
    if (!hadEssay.current) return;
    hadEssay.current = false;
    if (contentTab !== 'essays') {
      returnSlug.current = null;
      listScroll.current = 0;
      return;
    }
    const top = listScroll.current;
    const slug = returnSlug.current;
    const frame = requestAnimationFrame(() => {
      if (body) body.scrollTop = top;
      const card = slug ? cardRefs.current.get(slug) : undefined;
      (card ?? headingRef.current)?.focus({ preventScroll: true });
      announce('Returned to Essays');
    });
    return () => cancelAnimationFrame(frame);
  }, [essaySlug, focusEnabled, contentTab]);

  // A new tab or section starts at the top; returning from an essay is handled
  // by the effect above so the list keeps its place.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [contentTab, portfolioTab, section.id]);

  // Search and progressive disclosure belong to one tab at a time.
  useEffect(() => {
    setQuery('');
    setYearFilter('all');
    setVisibleMedia(20);
    setVisiblePosts(20);
  }, [contentTab]);

  useEffect(() => {
    setVisiblePosts(20);
  }, [query]);

  useEffect(() => {
    if (!essaySlug) {
      setEssayContent(null);
      setEssayLoading(false);
      setEssayError(false);
      return;
    }
    let cancelled = false;
    setEssayContent(null);
    setEssayError(false);
    setEssayLoading(true);
    loadEssayContent(essaySlug)
      .then((content) => {
        if (cancelled) return;
        setEssayContent(content);
        setEssayLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setEssayError(true);
        setEssayLoading(false);
        interaction.interact('error', { source: 'system' });
      });
    return () => {
      cancelled = true;
    };
  }, [essaySlug, essayReload]);

  // Posts and media metadata are separate on-demand chunks: the menu and the
  // essay index never pay for them.
  useEffect(() => {
    if (section.id !== 'content') return;
    let cancelled = false;

    if (contentTab === 'posts' && posts === null) {
      setPostsLoading(true);
      import('../data/posts')
        .then((data) => { if (!cancelled) setPosts(data.POSTS); })
        .catch(() => { if (!cancelled) setPosts([]); })
        .finally(() => { if (!cancelled) setPostsLoading(false); });
    }

    const needsMedia = contentTab === 'podcasts' || contentTab === 'lectures' || contentTab === 'tutorials' || contentTab === 'reading';
    if (needsMedia && media === null) {
      setMediaLoading(true);
      import('../data/media')
        .then((data) => {
          if (!cancelled) {
            setMedia({
              valueStack: data.PODCASTS_VALUE_STACK,
              appearances: data.PODCASTS_APPEARANCES,
              lectures: data.LECTURES,
              tutorials: data.TUTORIALS,
              reading: data.READING_LIST,
            });
          }
        })
        .catch(() => {
          if (!cancelled) setMedia({ valueStack: [], appearances: [], lectures: [], tutorials: [], reading: [] });
        })
        .finally(() => { if (!cancelled) setMediaLoading(false); });
    }

    return () => { cancelled = true; };
  }, [contentTab, section.id, posts, media]);

  const rankedPosts = useMemo(
    () => (posts ? [...posts].sort((a, b) => postEngagement(b) - postEngagement(a)) : []),
    [posts]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (...parts: (string | undefined)[]): boolean =>
    !normalizedQuery || parts.some(part => part?.toLowerCase().includes(normalizedQuery));

  const filteredEssays = useMemo(
    () => [...ESSAYS].sort(newestFirst).filter(essay => (
      !normalizedQuery
      || essay.title.toLowerCase().includes(normalizedQuery)
      || essay.excerpt.toLowerCase().includes(normalizedQuery)
    )),
    [normalizedQuery]
  );

  const orderedEssays = useMemo(() => [...ESSAYS].sort(newestFirst), []);
  const essayDoc = useMemo(() => (essayContent ? parseEssay(essayContent) : null), [essayContent]);
  const essayIndex = selectedEssay
    ? orderedEssays.findIndex(essay => essay.slug === selectedEssay.slug)
    : -1;
  const newerEssay = essayIndex > 0 ? orderedEssays[essayIndex - 1] : undefined;
  const olderEssay = essayIndex >= 0 && essayIndex < orderedEssays.length - 1
    ? orderedEssays[essayIndex + 1]
    : undefined;

  const filteredPosts = useMemo(
    () => rankedPosts.filter(post => (
      !normalizedQuery || post.text.toLowerCase().includes(normalizedQuery)
    )),
    [rankedPosts, normalizedQuery]
  );

  const openEssay = (post: EssaySummary) => {
    if (essaySlug === post.slug) return;
    listScroll.current = bodyRef.current?.scrollTop ?? 0;
    returnSlug.current = post.slug;
    navigate(pathForEssay(post.slug));
  };

  const openEssayBySlug = useCallback((slug: string) => {
    if (slug === essaySlug) return;
    navigate(pathForEssay(slug));
  }, [essaySlug]);

  const handleBack = useCallback(() => {
    if (closingTimer.current !== null) return;
    interaction.interact('back', { source: 'pointer' });
    if (essaySlug) {
      closeTo('/content/essays');
      return;
    }
    // Shrink toward the card that opened this section, even after tab changes
    // cleared the entry origin.
    const panel = panelRef.current;
    const card = document.querySelector<HTMLElement>(`[data-section-id="${section.id}"]`);
    if (panel && card) {
      const panelRect = panel.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      panel.style.transformOrigin = `${cardRect.left + cardRect.width / 2 - panelRect.left}px ${cardRect.top + cardRect.height / 2 - panelRect.top}px`;
    }
    if (reducedMotion) {
      onBack();
      return;
    }
    setClosing(true);
    closingTimer.current = window.setTimeout(() => onBack(), CLOSE_MS);
  }, [essaySlug, onBack, reducedMotion, section.id]);

  useEffect(() => () => {
    if (closingTimer.current !== null) window.clearTimeout(closingTimer.current);
  }, []);

  const goContentTab = useCallback((tab: ContentTab, source: 'pointer' | 'keyboard' = 'pointer') => {
    if (tab === contentTab && !essaySlug) return;
    interaction.interact('cursor', {
      id: `content-tab:${tab}`,
      source,
      haptic: source === 'pointer' ? 'tick' : undefined,
    });
    navigate(pathForTab('content', tab));
  }, [contentTab, essaySlug]);

  const handleContentTabChange = (tab: ContentTab, source: 'pointer' | 'keyboard' = 'pointer') => {
    goContentTab(tab, source);
  };

  const handleTabChange = (tab: PortfolioTab, source: 'pointer' | 'keyboard' = 'pointer') => {
    if (portfolioTab === tab) return;
    interaction.interact('cursor', {
      id: `portfolio-tab:${tab}`,
      source,
      haptic: source === 'pointer' ? 'tick' : undefined,
    });
    navigate(pathForTab('portfolio', tab));
  };

  // Escape closes the reader or the screen; Tab stays inside the dialog and
  // 1–6 switch Content tabs, matching the help bar.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (trapTabKey(event, dialogRef.current)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        handleBack();
        return;
      }
      if (
        section.id === 'content'
        && !essaySlug
        && /^[1-6]$/.test(event.key)
        && !(event.target instanceof HTMLElement
          && event.target.closest('input, textarea, select, [contenteditable="true"]'))
      ) {
        const tab = CONTENT_TAB_IDS[Number(event.key) - 1];
        if (tab) {
          event.preventDefault();
          goContentTab(tab, 'keyboard');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [essaySlug, handleBack, goContentTab, section.id]);

  const panelDir: 'next' | 'prev' = (() => {
    if (essaySlug && !previous?.slug) return 'next';
    if (!essaySlug && previous?.slug) return 'prev';
    if (previous && previous.section === section.id && previous.tab) {
      const list: readonly string[] = section.id === 'portfolio' ? PORTFOLIO_TAB_IDS : CONTENT_TAB_IDS;
      const nextTab = section.id === 'portfolio' ? portfolioTab : contentTab;
      const previousIndex = list.indexOf(previous.tab);
      const nextIndex = list.indexOf(nextTab);
      if (previousIndex >= 0 && nextIndex >= 0 && previousIndex !== nextIndex) {
        return nextIndex > previousIndex ? 'next' : 'prev';
      }
    }
    return 'next';
  })();
  const animatePanel = previous?.section === section.id;

  const renderPortfolio = () => (
    <div className="flex flex-col h-full">
      <Tabs
        baseId="portfolio"
        label="Portfolio sections"
        items={PORTFOLIO_TABS}
        activeId={portfolioTab}
        onChange={(id, source) => handleTabChange(id as PortfolioTab, source)}
        layout="portfolio"
        className="mb-6 shrink-0 md:mb-8"
      />

      <div
        key={portfolioTab}
        data-dir={panelDir}
        role="tabpanel"
        id={tabPanelId('portfolio', portfolioTab)}
        aria-labelledby={tabId('portfolio', portfolioTab)}
        tabIndex={0}
        className={`flex-grow overflow-auto ps2-scroll focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white ${animatePanel ? 'panel-shift' : ''}`}
      >
        {portfolioTab === 'projects' ? (
          <ProjectsTab />
        ) : portfolioTab === 'design' ? (
          <DesignTab />
        ) : (
          <InvestmentsTab />
        )}
      </div>
    </div>
  );

  const renderEssays = () => {
    if (selectedEssay) {
      return (
        <EssayArticle
          essay={selectedEssay}
          doc={essayDoc}
          loading={essayLoading}
          error={essayError}
          titleRef={essayTitleRef}
          onRetry={() => setEssayReload(count => count + 1)}
          onNavigateEssay={openEssayBySlug}
          newer={newerEssay}
          older={olderEssay}
        />
      );
    }

    if (filteredEssays.length === 0) return null;

    const [featured, ...rest] = filteredEssays;
    const sourceLink = (post: EssaySummary) => post.sourceUrl ? (
      <a
        href={post.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => interaction.interact('confirm', { source: 'pointer' })}
        className="essay-source"
      >
        {post.sourceLabel || 'Published elsewhere'}
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    ) : null;

    const open = (post: EssaySummary) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      openEssay(post);
    };

    const registerCard = (slug: string) => (element: HTMLAnchorElement | null) => {
      if (element) cardRefs.current.set(slug, element);
      else cardRefs.current.delete(slug);
    };

    return (
      <div className="essay-index">
        <div className="essay-featured-wrap">
          <FeaturedEssay
            essay={featured}
            href={pathForEssay(featured.slug)}
            feedbackId={`essay:${featured.slug}`}
            innerRef={registerCard(featured.slug)}
            onNavigate={open(featured)}
          />
          {sourceLink(featured)}
        </div>

        {rest.length > 0 && (
          <div className="essay-index__rows">
            {rest.map((post) => (
              <div key={post.slug} className="essay-index__item">
                <EssayRow
                  essay={post}
                  href={pathForEssay(post.slug)}
                  feedbackId={`essay:${post.slug}`}
                  innerRef={registerCard(post.slug)}
                  onNavigate={open(post)}
                />
                {sourceLink(post)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderContentTabs = () => (
    <Tabs
      baseId="content"
      label="Content sections"
      items={CONTENT_TABS}
      activeId={contentTab}
      onChange={(id, source) => handleContentTabChange(id as ContentTab, source)}
      layout="content"
      className="shrink-0"
    />
  );

  const renderListSkeleton = (count: number, variant: 'row' | 'card' | 'media' = 'card') => (
    <ListSkeleton count={count} variant={variant} />
  );

  const renderEmptyState = (
    title: string,
    message = 'Try a different search, or clear the filters to see everything.',
    error = false,
  ) => {
    const filtered = !!query.trim() || yearFilter !== 'all';
    return (
      <EmptyState
        title={title}
        message={filtered ? message : undefined}
        actionLabel={filtered ? 'Clear filters' : undefined}
        onAction={filtered ? () => { setQuery(''); setYearFilter('all'); } : undefined}
        error={error}
      />
    );
  };

  const renderYearHeading = (year: string, count: number) => (
    <h4 className="flex items-center gap-2 border-b border-blue-400/20 pb-1 font-mono text-[12px] uppercase tracking-[0.2em] text-[var(--text-secondary)]">
      <span>{year}</span>
      <span aria-hidden="true" className="text-[var(--accent-soft)]">·</span>
      <span>{count}</span>
    </h4>
  );

  const renderShowMore = (remaining: number, noun: string, onClick: () => void, id: string) => (
    <button
      type="button"
      onFocus={() => interaction.interact('cursor', { id, source: 'focus' })}
      onClick={() => {
        interaction.interact('cursor', { id, source: 'pointer', haptic: 'tick' });
        onClick();
      }}
      className="w-full min-h-[44px] border border-blue-400/30 bg-blue-900/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-blue-100 transition-colors hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      Show more {noun} ({remaining} remaining)
    </button>
  );

  const renderContentHub = () => {
    const meta = CONTENT_TAB_META[contentTab];
    const searchable = contentTab === 'essays'
      || contentTab === 'posts'
      || contentTab === 'podcasts'
      || contentTab === 'lectures';

    const podcastItems: MediaItem[] = media ? [...media.valueStack, ...media.appearances] : [];
    const isFiltered = !!normalizedQuery || yearFilter !== 'all';
    const matchesYear = (item: { date?: string }) => yearFilter === 'all' || yearOf(item.date) === yearFilter;
    const filteredPodcasts = podcastItems.filter(item => matchesQuery(item.title, item.source) && matchesYear(item));
    const filteredValueStack: MediaItem[] = (media?.valueStack ?? [])
      .filter(item => matchesQuery(item.title, item.source) && matchesYear(item));
    const filteredAppearances: MediaItem[] = (media?.appearances ?? [])
      .filter(item => matchesQuery(item.title, item.source) && matchesYear(item));
    const filteredLectures: MediaItem[] = (media?.lectures ?? [])
      .filter(item => matchesQuery(item.title, item.source) && matchesYear(item));
    const filteredTutorials: MediaItem[] = (media?.tutorials ?? []).filter(item => matchesQuery(item.title, item.source));
    const filteredReading: ReadingItem[] = (media?.reading ?? []).filter(item => matchesQuery(item.title, item.author));

    // One year filter serves the two chronological lists; it stays out of the
    // way when a list covers a single year.
    const yearPool = contentTab === 'lectures'
      ? media?.lectures ?? []
      : contentTab === 'podcasts'
        ? podcastItems
        : [];
    const yearRank = (year: string) => {
      const value = Number.parseInt(year, 10) || 0;
      return /BCE/i.test(year) ? -value : value;
    };
    const yearOptions = Array.from(new Set<string>(yearPool.map(item => yearOf(item.date))))
      .filter(year => year !== 'Undated')
      .sort((a, b) => yearRank(b) - yearRank(a));

    const counts: Record<ContentTab, { total: number; shown: number; loading: boolean }> = {
      essays: { total: ESSAYS.length, shown: filteredEssays.length, loading: false },
      posts: { total: rankedPosts.length, shown: filteredPosts.length, loading: posts === null || postsLoading },
      podcasts: { total: podcastItems.length, shown: filteredPodcasts.length, loading: media === null || mediaLoading },
      lectures: { total: media?.lectures.length ?? 0, shown: filteredLectures.length, loading: media === null || mediaLoading },
      tutorials: { total: media?.tutorials.length ?? 0, shown: filteredTutorials.length, loading: media === null || mediaLoading },
      reading: { total: media?.reading.length ?? 0, shown: filteredReading.length, loading: media === null || mediaLoading },
    };
    const current = counts[contentTab];
    const countText = current.loading
      ? `Loading ${meta.noun}…`
      : isFiltered
        ? `${current.shown} of ${current.total} ${meta.noun}`
        : `${current.total} ${meta.noun}`;

    const featuredEpisode = filteredValueStack[0];
    const hostRest = filteredValueStack.slice(1, 1 + visibleMedia);
    const remainingEpisodes = filteredValueStack.length - 1 - hostRest.length;

    const emptyFor = (tab: ContentTab): string => {
      if (tab === 'lectures' && yearFilter !== 'all') return `No lectures for ${yearFilter} yet.`;
      if (tab === 'podcasts' && yearFilter !== 'all') return `No episodes for ${yearFilter} yet.`;
      if (normalizedQuery) return `No ${meta.noun} match “${query.trim()}”.`;
      if (tab === 'essays') return 'No essays are listed yet.';
      if (tab === 'posts') return 'No posts are listed yet.';
      if (tab === 'podcasts') return 'No episodes are listed yet.';
      if (tab === 'lectures') return 'No lectures are listed yet.';
      if (tab === 'tutorials') return 'No tutorials are listed yet.';
      return 'Nothing on the shelf yet.';
    };

    return (
      <div
        key={essaySlug ?? contentTab}
        data-dir={panelDir}
        role="tabpanel"
        id={tabPanelId('content', contentTab)}
        aria-labelledby={tabId('content', contentTab)}
        className={animatePanel ? 'panel-shift' : undefined}
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="content-count ps2-meta" role="status" aria-live="polite">
            {countText}
          </p>
          {searchable && (
            <div className="flex w-full flex-wrap items-stretch gap-2 sm:w-auto">
              <label htmlFor="content-search" className="sr-only">Search {meta.noun}</label>
              <input
                id="content-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${meta.noun}`}
                autoComplete="off"
                enterKeyHint="search"
                className="min-h-[44px] w-full border border-blue-400/30 bg-black/40 px-3 text-base font-light text-white placeholder:text-blue-200/75 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300 sm:w-56"
              />
              {(contentTab === 'lectures' || contentTab === 'podcasts') && yearOptions.length > 1 && (
                <>
                  <label htmlFor="content-year" className="sr-only">Filter {meta.noun} by year</label>
                  <select
                    id="content-year"
                    value={yearFilter}
                    onChange={(event) => {
                      setYearFilter(event.target.value);
                      setVisibleMedia(20);
                      interaction.interact('cursor', { id: 'content:year', source: 'pointer', haptic: 'tick' });
                    }}
                    className="min-h-[44px] w-full border border-blue-400/30 bg-black/40 px-2 text-base font-light text-blue-100 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300 sm:w-auto sm:text-sm"
                  >
                    <option value="all">All years</option>
                    {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                  </select>
                </>
              )}
              {query.trim() && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="min-h-[44px] shrink-0 border border-blue-400/30 px-3 font-mono text-[12px] uppercase tracking-[0.16em] text-blue-100 transition-colors hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {contentTab === 'essays' && (
          filteredEssays.length === 0
            ? renderEmptyState(emptyFor('essays'))
            : renderEssays()
        )}

        {contentTab === 'posts' && (
          <div>
            {postsLoading || posts === null
              ? renderListSkeleton(4, 'card')
              : filteredPosts.length === 0
                ? renderEmptyState(emptyFor('posts'))
                : (
                  <>
                    <div className="post-grid">
                      {filteredPosts.slice(0, visiblePosts).map(item => (
                        <PostCard key={item.id} post={item} />
                      ))}
                    </div>
                    {filteredPosts.length > visiblePosts && renderShowMore(
                      filteredPosts.length - visiblePosts,
                      'posts',
                      () => setVisiblePosts(count => count + 20),
                      'posts:show-more',
                    )}
                  </>
                )}
          </div>
        )}

        {contentTab === 'podcasts' && (
          mediaLoading || !media ? renderListSkeleton(4, 'media') : (
            filteredPodcasts.length === 0 ? renderEmptyState(emptyFor('podcasts')) : (
              <div className="content-sections">
                <section className="content-section" aria-labelledby="podcast-host-heading">
                  <h3 id="podcast-host-heading" className="content-section__head ps2-label">
                    Value Stack <span className="content-section__count">{filteredValueStack.length}</span>
                  </h3>
                  {filteredValueStack.length === 0 ? (
                    <p className="content-section__empty">No host episodes for this filter.</p>
                  ) : (
                    <>
                      {featuredEpisode && (
                        <MediaFeature item={featuredEpisode} label="Latest episode" />
                      )}
                      {groupByYear(hostRest).map(group => (
                        <div key={group.year} className="content-group">
                          {renderYearHeading(group.year, group.items.length)}
                          <div className="media-rows">
                            {group.items.map(item => <MediaRow key={item.url} item={item} />)}
                          </div>
                        </div>
                      ))}
                      {remainingEpisodes > 0 && renderShowMore(
                        remainingEpisodes,
                        'episodes',
                        () => setVisibleMedia(count => count + 20),
                        'podcasts:show-more',
                      )}
                    </>
                  )}
                </section>

                <section className="content-section" aria-labelledby="podcast-guest-heading">
                  <h3 id="podcast-guest-heading" className="content-section__head ps2-label">
                    Guest appearances <span className="content-section__count">{filteredAppearances.length}</span>
                  </h3>
                  {filteredAppearances.length === 0 ? (
                    <p className="content-section__empty">No guest appearances for this filter.</p>
                  ) : (
                    groupByYear(filteredAppearances).map(group => (
                      <div key={group.year} className="content-group">
                        {renderYearHeading(group.year, group.items.length)}
                        <div className="media-rows">
                          {group.items.map(item => <MediaRow key={item.url} item={item} />)}
                        </div>
                      </div>
                    ))
                  )}
                </section>
              </div>
            )
          )
        )}

        {contentTab === 'lectures' && (
          mediaLoading || !media ? renderListSkeleton(4, 'media') : (
            filteredLectures.length === 0 ? renderEmptyState(emptyFor('lectures')) : (
              <div className="content-sections content-sections--tight">
                {groupByYear(filteredLectures).map(group => (
                  <section key={group.year} className="content-group">
                    {renderYearHeading(group.year, group.items.length)}
                    {groupBySource(group.items).map(sourceGroup => (
                      <div key={sourceGroup.source} className="content-venue">
                        <p className="content-venue__head">
                          <span>{sourceGroup.source}</span>
                          <span className="content-venue__count">{sourceGroup.items.length}</span>
                        </p>
                        <div className="media-rows">
                          {sourceGroup.items.map(item => <MediaRow key={item.url} item={item} wide />)}
                        </div>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            )
          )
        )}

        {contentTab === 'tutorials' && (
          mediaLoading || !media ? renderListSkeleton(4, 'card') : (
            filteredTutorials.length === 0
              ? renderEmptyState(emptyFor('tutorials'))
              : (
                <div className="tutorial-rows">
                  {filteredTutorials.map(item => <TutorialRow key={item.url} item={item} />)}
                </div>
              )
          )
        )}

        {contentTab === 'reading' && (
          mediaLoading || !media ? renderListSkeleton(4, 'row') : (
            filteredReading.length === 0
              ? renderEmptyState(emptyFor('reading'))
              : (
                <div className="content-sections content-sections--tight">
                  {groupByYear(filteredReading).map(group => (
                    <section key={group.year} className="content-group">
                      {renderYearHeading(group.year, group.items.length)}
                      <div className="reading-rows">
                        {group.items.map(item => <ReadingRow key={item.url} item={item} />)}
                      </div>
                    </section>
                  ))}
                </div>
              )
          )
        )}
      </div>
    );
  };

  const getContent = () => {
    switch (section.id) {
      case 'social': return <SocialScreen />;
      case 'about': return <AboutScreen />;
      case 'portfolio': return renderPortfolio();
      case 'book': return <BookScreen />;
      case 'content': return renderContentHub();
      case 'work': return <WorkScreen />;
      default: return (
        <EmptyState
          title="That screen is not available"
          message="Return to the main menu to choose another section."
          error
        />
      );
    }
  };

  const helpActions = selectedEssay
    ? [
        { keys: ['Esc'], label: 'Back', touch: 'Tap Back for the list' },
        { keys: ['↑', '↓'], label: 'Scroll', touch: 'Scroll to read' },
      ]
    : section.id === 'content'
      ? [
          { keys: ['Esc'], label: 'Home', touch: 'Tap Back to leave' },
          { keys: ['↑', '↓'], label: 'Scroll', touch: 'Scroll to read' },
          { keys: ['1–6'], label: 'Tabs', touch: 'Tap a tab' },
        ]
      : [
          { keys: ['Esc'], label: 'Home', touch: 'Tap Back to leave' },
          { keys: ['↑', '↓'], label: 'Scroll', touch: 'Scroll to read' },
        ];

  const helpDescription = selectedEssay
    ? 'Press Escape to return to the essay list. Up and down arrows scroll the essay.'
    : section.id === 'content'
      ? 'Press Escape to return to the main menu. Up and down arrows scroll. Number keys 1 to 6 switch content tabs.'
      : 'Press Escape to return to the main menu. Up and down arrows scroll.';

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={selectedEssay ? 'essay-title' : 'screen-title'}
      tabIndex={-1}
      className={`screen-backdrop fixed inset-x-0 top-0 z-50 flex items-stretch justify-center ${selectedEssay ? 'px-2' : 'px-4'} pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:p-12 bg-black/60 focus:outline-none`}
      style={{ height: 'var(--app-height)' }}
      data-closing={closing ? 'true' : undefined}
    >
      <div
        ref={panelRef}
        className="screen-panel w-full max-w-5xl h-full min-h-0 flex flex-col border border-blue-500/30 rounded-lg overflow-hidden bg-[var(--bg)] shadow-[0_0_50px_rgba(110,168,255,0.14)]"
        data-closing={closing ? 'true' : undefined}
      >
        
        {/* Header */}
        <div className="shrink-0 h-16 border-b border-blue-500/30 flex items-center justify-between px-6 bg-gradient-to-r from-blue-900/20 to-transparent overflow-hidden">
          <div className="flex items-center space-x-4">
            <section.icon className="w-6 h-6 text-blue-400" aria-hidden="true" />
            <h1
              id="screen-title"
              ref={headingRef}
              tabIndex={-1}
              className="ps2-screen-title focus:outline-none"
            >
              {section.title}
            </h1>
          </div>
        </div>

        {section.id === 'content' && !selectedEssay && renderContentTabs()}

        {selectedEssay && (
          <ReaderBar
            essay={selectedEssay}
            headings={essayDoc?.headings ?? []}
            bodyRef={bodyRef}
            content={essayContent}
          />
        )}

        {/* Content Body */}
        <div ref={bodyRef} className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative ps2-scroll ${selectedEssay ? 'px-4 py-6 md:p-10' : 'p-6 md:p-10'}`}>
          {getContent()}
        </div>

        {/* One context-aware footer: Back, this screen's shortcuts, the system toggles */}
        <div className="shrink-0 border-t border-blue-500/30 flex flex-wrap items-center justify-between gap-x-2 md:gap-x-4 gap-y-1 px-4 md:px-6 py-2 bg-black/40 text-sm">
          <button 
            type="button"
            onClick={handleBack}
            onFocus={() => interaction.interact('cursor', { id: 'nav:back', source: 'focus' })}
            className="flex min-h-[44px] items-center space-x-2 text-blue-300 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span className="uppercase tracking-[0.14em] font-mono text-xs">
              {selectedEssay ? "Return to List" : "Back to Home"}
            </span>
          </button>
          <HelpBar
            className="order-3 w-full md:order-2 md:w-auto"
            actions={helpActions}
            description={helpDescription}
          />
          <SystemToggles />
        </div>
      </div>
    </div>
  );
};

export default ContentScreen;