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
import {
  PORTFOLIO_DATA,
  INVESTMENT_DATA,
  DESIGN_DATA,
  BOOK_DATA,
  WORK_DATA,
  SOCIAL_LINKS,
} from '../constants';
import { ESSAYS } from '../data/essays';
import { loadEssayContent } from '../data/essayContent';
import { ESSAY_IMAGE_META, POST_IMAGE_META } from '../data/imageMeta';
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
import SystemSettings from './SystemSettings';
import SystemCard from './SystemCard';
import Tabs, { tabId, tabPanelId } from './Tabs';

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

const twitterImage = (url: string, format: 'webp' | 'jpg') =>
  `${url}${url.includes('?') ? '&' : '?'}format=${format}&name=small`;

const yearOf = (date?: string): string => {
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
      return Number(b.year) - Number(a.year);
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

const CONTENT_TAB_META: Record<ContentTab, { noun: string; blurb: string }> = {
  essays: { noun: 'essays', blurb: 'Long-form writing, newest first.' },
  posts: { noun: 'posts', blurb: 'Top posts by engagement from @BTCBap.' },
  podcasts: { noun: 'episodes', blurb: 'Host of Value Stack, plus guest appearances.' },
  lectures: { noun: 'lectures', blurb: 'Talks and panels, grouped by year.' },
  tutorials: { noun: 'tutorials', blurb: 'Guides and walkthroughs.' },
  reading: { noun: 'books and essays', blurb: 'Worth your time.' },
};

interface MediaData {
  valueStack: MediaItem[];
  appearances: MediaItem[];
  lectures: MediaItem[];
  tutorials: MediaItem[];
  reading: ReadingItem[];
}

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const re = /(\*\*[\s\S]*?\*\*|\*[^*\n]+?\*|\[[^\]]+\]\([^)]+\))/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) {
      parts.push(text.slice(last, m.index));
    }
    const tok = m[0];
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length >= 4) {
      parts.push(
        <span key={`${keyPrefix}-b-${i++}`} className="font-bold text-white text-base md:text-lg tracking-wide">
          {tok.slice(2, -2)}
        </span>
      );
    } else if (tok.startsWith('*') && tok.endsWith('*') && tok.length >= 2) {
      parts.push(<em key={`${keyPrefix}-i-${i++}`}>{tok.slice(1, -1)}</em>);
    } else {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm) {
        parts.push(
          <a
            key={`${keyPrefix}-a-${i++}`}
            href={lm[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline underline-offset-2 hover:text-white"
          >
            {lm[1]}
          </a>
        );
      } else {
        parts.push(tok);
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

const EssayBody: React.FC<{ content: string }> = ({ content }) => {
  const nodes: React.ReactNode[] = [];
  const re = /%%(YOUTUBE|IMAGE|TWEET):([\s\S]*?)%%/g;
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (m.index > last) {
      const text = content.slice(last, m.index);
      if (text.length) {
        nodes.push(
          <div key={`t-${i++}`} className="whitespace-pre-wrap leading-relaxed">
            {renderInline(text, `t${i}`)}
          </div>
        );
      }
    }
    try {
      const data = JSON.parse(m[2]);
      if (m[1] === 'YOUTUBE' && data.id) {
        const start = data.start ? `&start=${encodeURIComponent(data.start)}` : '';
        nodes.push(
          <div key={`yt-${i++}`} className="my-6 w-full overflow-hidden border border-blue-500/30 bg-black/40">
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube-nocookie.com/embed/${data.id}?rel=0${start}`}
                title="YouTube video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          </div>
        );
      } else if (m[1] === 'IMAGE' && data.src) {
        const imageMeta = ESSAY_IMAGE_META[data.src];
        nodes.push(
          <figure key={`img-${i++}`} className="my-6">
            <img
              src={data.src}
              srcSet={imageMeta?.srcSet || undefined}
              sizes={imageMeta?.sizes}
              width={imageMeta?.width}
              height={imageMeta?.height}
              alt={data.alt || data.caption || ''}
              loading="lazy"
              decoding="async"
              className="max-w-full w-full h-auto object-contain border border-blue-500/20"
            />
            {data.caption && (
              <figcaption className="mt-2 text-xs text-blue-400/80 font-mono italic">
                {renderInline(data.caption, `cap${i}`)}
              </figcaption>
            )}
          </figure>
        );
      } else if (m[1] === 'TWEET') {
        nodes.push(
          <a
            key={`tw-${i++}`}
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="my-6 block border border-blue-500/30 bg-blue-900/10 p-4 hover:border-blue-400 transition-colors"
          >
            <div className="text-white font-bold">{data.name}</div>
            {data.username && (
              <div className="text-xs text-blue-400 font-mono mb-2">@{data.username}</div>
            )}
            <p className="text-sm text-blue-100 whitespace-pre-wrap">{data.text}</p>
          </a>
        );
      }
    } catch {
      // skip malformed media tokens
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    const text = content.slice(last);
    if (text.length) {
      nodes.push(
        <div key={`t-${i++}`} className="whitespace-pre-wrap leading-relaxed">
          {renderInline(text, `t${i}`)}
        </div>
      );
    }
  }
  return <>{nodes}</>;
};

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

  // Essay reader: start at the top, focus the title, and put the reader back
  // where they were (scroll and card focus) on return.
  useEffect(() => {
    const body = bodyRef.current;
    if (essaySlug) {
      if (!hadEssay.current) {
        hadEssay.current = true;
        body?.scrollTo({ top: 0 });
      }
      if (!focusEnabled) return;
      const frame = requestAnimationFrame(() => essayTitleRef.current?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(frame);
    }
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

  const renderMediaCard = (item: MediaItem, extra?: string) => (
    <SystemCard
      key={item.url}
      href={item.url}
      external
      feedbackId={`media:${item.url}`}
      title={item.title}
      meta={item.date}
      footer={extra || item.source}
    />
  );

  const renderPostCard = (item: PostItem) => {
    const raw = item.text.trim() || 'View post';
    const title = raw.length > 160 ? `${raw.slice(0, 157).trimEnd()}…` : raw;
    const imageMeta = item.image ? POST_IMAGE_META[item.image] : undefined;
    return (
      <SystemCard
        key={item.id}
        href={item.url}
        external
        feedbackId={`post:${item.id}`}
        title={title}
        titleClassName="break-words"
        meta={item.date}
        media={item.image ? (
          <div className="system-card__media">
            <picture className="contents">
              <source srcSet={twitterImage(item.image, 'webp')} type="image/webp" />
              <img
                src={twitterImage(item.image, 'jpg')}
                alt=""
                referrerPolicy="no-referrer"
                width={imageMeta?.width}
                height={imageMeta?.height}
                loading="lazy"
                decoding="async"
                style={imageMeta ? { aspectRatio: `${imageMeta.width} / ${imageMeta.height}` } : undefined}
                className="max-h-96 max-w-full w-auto h-auto object-contain"
              />
            </picture>
          </div>
        ) : undefined}
        footer={(
          <>
            <span>@BTCBap</span>
            <span aria-hidden="true"> :: </span>
            <span>{item.likes.toLocaleString()} likes</span>
          </>
        )}
      />
    );
  };

  const renderReadingCard = (item: ReadingItem) => (
    <SystemCard
      key={item.url}
      href={item.url}
      external
      feedbackId={`reading:${item.url}`}
      title={item.title}
      meta={item.date}
      footer={item.author}
    />
  );

  // Render Helpers
  const renderSocials = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {SOCIAL_LINKS.map((link) => {
        const isEmail = link.url.startsWith('mailto:');
        return (
          <SystemCard
            key={link.platform}
            href={link.url}
            external={!isEmail}
            feedbackId={`social:${link.platform}`}
            eyebrow={link.platform}
            title={<span className="font-mono text-lg normal-case tracking-normal">{link.handle}</span>}
            onNavigate={() => window.umami?.track('social-click', { platform: link.platform })}
          />
        );
      })}
    </div>
  );

  const renderAbout = () => (
    <div className="max-w-3xl mx-auto space-y-8 text-blue-100 font-light">
      <div className="flex justify-center">
        <div className="border border-blue-500/40 p-1 bg-black/40 shadow-[0_0_28px_rgba(50,100,255,0.28)]">
          <img
            src="/about-portrait.webp"
            alt="Pencil sketch portrait of Zach Wischler"
            width={320}
            height={320}
            className="block w-36 md:w-40 h-auto"
          />
        </div>
      </div>

      <div className="border-b border-blue-500/30 pb-6">
        <p className="text-xl leading-relaxed text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">
          Dedicated to advancing individual sovereignty through cryptography.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
           <h3 className="text-blue-400 uppercase tracking-widest text-xs mb-3 border-l-2 border-blue-500 pl-2">Core Beliefs</h3>
           <ul className="space-y-3 text-sm">
             {[
               "Financial freedom from centralized authority",
               "Data ownership and privacy as fundamental rights",
               "Time is our scarcest asset",
               "Critical thinking and AI literacy are the major skills you'll need to thrive",
               "Tools should be open and accessible to all"
             ].map((belief, i) => (
               <li key={i} className="flex items-start">
                 <span className="mr-2 text-blue-500">▶</span>
                 <span className="text-blue-100/90">{belief}</span>
               </li>
             ))}
           </ul>
        </div>
        <div>
           <h3 className="text-blue-400 uppercase tracking-widest text-xs mb-3 border-l-2 border-blue-500 pl-2">Current Objectives</h3>
           <ul className="space-y-3 text-sm">
             {[
               "Building open source tools",
               "Leveraging AI and automation to win back time",
               "Promoting Bitcoin adoption and freedom technologies",
               "Prioritizing long-term value creation over short-term gains",
             ].map((goal, i) => (
               <li key={i} className="flex items-start">
                 <span className="mr-2 text-blue-500">◉</span>
                 <span className="text-blue-100/90">{goal}</span>
               </li>
             ))}
           </ul>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-blue-200/80">
        After a decade in traditional finance, I saw the limitations of centralized institutions firsthand. My time is now dedicated to building the alternatives that prioritize individual freedom, ensuring users retain control over their assets and digital lives.
      </p>
    </div>
  );

  const renderInvestmentTable = () => (
    <div className="bg-black/40 border border-blue-500/20">
      <table className="w-full text-left">
        <thead className="bg-blue-900/20 text-blue-300 text-xs uppercase tracking-wider font-mono">
          <tr>
            <th className="p-4">Asset</th>
            <th className="p-4">Stage / Type</th>
            <th className="p-4 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-blue-500/10 font-mono text-sm">
          {INVESTMENT_DATA.map((inv, i) => (
            <tr key={i} className="hover:bg-blue-900/10 transition-colors">
              <td className="p-4">
                <div className="text-white font-bold">{inv.asset}</div>
                {inv.ticker && <div className="text-xs text-blue-500">{inv.ticker}</div>}
              </td>
              <td className="p-4 text-blue-200">{inv.type}</td>
              <td className="p-4 text-right">
                <span className={`px-2 py-1 rounded text-xs ${
                  inv.status === 'Active' ? 'bg-green-900/30 text-green-400' :
                  inv.status === 'Acquired' ? 'bg-purple-900/30 text-purple-400' :
                  inv.status === 'Exited' ? 'bg-red-900/30 text-red-400' :
                  'bg-gray-800 text-gray-400'
                }`}>
                  {inv.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderDesigns = () => (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
      {DESIGN_DATA.map(item => (
        <figure
          key={item.image}
          className="bg-black/40 border border-blue-500/30 flex flex-col hover:border-blue-400 transition-colors"
        >
          <div className="aspect-square flex items-center justify-center p-2 md:p-4 bg-[#1c1c1c] border-b border-blue-500/30">
            <img
              src={item.image}
              srcSet={item.srcSet}
              sizes={item.sizes}
              alt={item.alt}
              width={item.width}
              height={item.height}
              loading="lazy"
              decoding="async"
              className="max-w-full max-h-full w-auto h-auto object-contain"
            />
          </div>
          <figcaption className="p-3 md:p-4 flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between md:gap-3">
            <span className="text-sm md:text-lg font-bold leading-snug text-white ps2-text-shadow">{item.title}</span>
            <span className="text-xs font-mono uppercase tracking-wider text-blue-400 shrink-0">{item.type}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );

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

      {/* Content Area */}
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
          <div className="space-y-3">
            {PORTFOLIO_DATA.map((item) => (
              <SystemCard
                key={item.title}
                href={item.url ?? '#'}
                external={!!item.url}
                feedbackId={`project:${item.title}`}
                leading={<span className="font-mono text-xs uppercase tracking-[0.18em] text-blue-200/80">{item.year}</span>}
                title={item.title}
                meta={item.role}
                description={item.description}
                footer={(
                  <span className="flex flex-wrap gap-1.5">
                    {item.tech.map(tech => (
                      <span key={tech} className="border border-blue-400/30 bg-blue-500/10 px-1.5 py-0.5 text-[11px] normal-case tracking-normal text-blue-100">
                        {tech}
                      </span>
                    ))}
                  </span>
                )}
                onNavigate={() => window.umami?.track('portfolio-project-click', { title: item.title })}
              />
            ))}
          </div>
        ) : portfolioTab === 'design' ? (
          renderDesigns()
        ) : (
          renderInvestmentTable()
        )}
      </div>
    </div>
  );

  const renderBooks = () => (
    <div className="flex items-center justify-center min-h-full">
      {BOOK_DATA.map((book, i) => {
        const handleOpen = () => {
          if (book.url) {
            interaction.interact('confirm', { source: 'pointer' });
            window.umami?.track('book-purchase-click', { title: book.title });
            window.open(book.url, '_blank', 'noopener,noreferrer');
          }
        };
        return (
          <div
            key={i}
            className="max-w-4xl w-full flex flex-col md:flex-row gap-8 md:gap-12 items-center bg-black/40 px-5 py-8 md:p-12 border border-blue-500/30 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onPointerEnter={(e) => {
              if (e.pointerType === 'mouse') {
                interaction.interact('cursor', { id: `book:${book.title}`, source: 'hover' });
              }
            }}
            onFocus={() => interaction.interact('cursor', { id: `book:${book.title}`, source: 'focus' })}
            onKeyDown={(e) => {
              if (e.repeat || e.target !== e.currentTarget) return;
              if (e.key === 'Enter') handleOpen();
            }}
            tabIndex={book.url ? 0 : undefined}
          >
            <div
              className={`w-48 h-72 shrink-0 ${book.coverImage ? '' : book.coverColor} shadow-[0_0_30px_rgba(234,88,12,0.3)] flex items-center justify-center text-center border-2 border-white/10 rotate-[-2deg] overflow-hidden ${book.url ? 'cursor-pointer' : ''}`}
              onClick={handleOpen}
            >
              {book.coverImage ? (
                <img
                  src={book.coverImage}
                  srcSet={book.coverSrcSet}
                  sizes="192px"
                  alt={book.title}
                  width={book.coverWidth ?? 640}
                  height={book.coverHeight ?? 960}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full p-4 border border-white/20 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-white/90 uppercase tracking-widest">{book.title}</span>
                  <span className="mt-4 text-xs text-white/70 uppercase tracking-widest">{book.author}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-center md:items-start text-center md:text-left">
              <h3 className="text-3xl md:text-4xl text-white mb-1">{book.title}</h3>
              {book.subtitle && <p className="text-sm text-blue-200/85 uppercase tracking-widest mb-3 font-mono">{book.subtitle}</p>}
              <div className="text-xl text-blue-400 mb-6">{book.author}</div>

              <div className="bg-blue-900/30 border border-blue-500/50 px-4 py-4 md:px-6 rounded mb-6">
                <p className="text-base text-blue-100 italic leading-relaxed">"{book.thoughts}"</p>
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-6">
                <span className="uppercase tracking-widest text-sm font-bold text-blue-200/85">Available Now</span>
                <span className="h-px w-8 bg-blue-500/50"></span>
                <span className="font-mono text-green-400">Bitcoin Magazine Books</span>
              </div>

              {book.url && (
                <button
                  onClick={handleOpen}
                  className="inline-flex min-h-[44px] items-center uppercase tracking-widest text-sm font-bold text-blue-100 border border-blue-400/50 px-6 py-3 rounded hover:bg-blue-500/20 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Get the Book →
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderEssays = () => {
    if (selectedEssay) {
       return (
         <div className="max-w-3xl mx-auto text-blue-100">
             {/* Header */}
             <div className="border-b border-blue-500/30 pb-4 mb-6 pt-2">
                 <h2
                   id="essay-title"
                   ref={essayTitleRef}
                   tabIndex={-1}
                   className="text-2xl font-bold text-white mb-2 leading-tight focus:outline-none"
                 >
                   {selectedEssay.title}
                 </h2>
                 <div className="flex items-center space-x-4 text-xs text-blue-400 font-mono">
                    <span>{selectedEssay.date}</span>
                    <span className="text-blue-600">//</span>
                    <span>{selectedEssay.readTime} read</span>
                 </div>
                 {selectedEssay.sourceUrl && (
                   <a
                     href={selectedEssay.sourceUrl}
                     target="_blank"
                     rel="noopener noreferrer"
                     onFocus={() => interaction.interact('cursor', { id: 'essay:source', source: 'focus' })}
                     onClick={() => interaction.interact('confirm', { source: 'pointer' })}
                     className="inline-block mt-2 text-xs text-blue-400 font-mono hover:text-white underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                   >
                     {selectedEssay.sourceLabel || 'Published elsewhere'}
                   </a>
                 )}
             </div>

             {/* Content - preserving whitespace, with **bold**, links, and Substack media */}
             <div className="leading-relaxed opacity-90 text-sm md:text-base font-light text-blue-50 pb-8" aria-busy={essayLoading}>
                 {essayLoading ? (
                   <div className="space-y-4" role="status" aria-live="polite">
                     <span className="sr-only">Loading essay…</span>
                     {[92, 100, 96, 88, 76, 100, 94].map((width, i) => (
                       <div
                         key={i}
                         className="h-4 bg-blue-900/40 animate-pulse motion-reduce:animate-none"
                         style={{ width: `${width}%` }}
                       />
                     ))}
                     <div className="h-48 bg-blue-900/20 animate-pulse motion-reduce:animate-none" />
                   </div>
                 ) : essayError ? (
                   <div className="border border-blue-500/30 bg-blue-900/10 p-6 text-sm text-blue-200" role="status">
                     <p>That file did not open.</p>
                     <button
                       type="button"
                       onFocus={() => interaction.interact('cursor', { id: 'essay:retry', source: 'focus' })}
                       onClick={() => setEssayReload(count => count + 1)}
                       className="mt-3 min-h-[44px] text-blue-300 hover:text-white uppercase tracking-widest font-mono text-xs underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                     >
                       Try again
                     </button>
                   </div>
                 ) : essayContent ? (
                   <EssayBody content={essayContent} />
                 ) : null}
             </div>
         </div>
       );
    }

    return (
        <div className="space-y-4">
          {filteredEssays.map((post) => (
            <article key={post.slug} className="space-y-1">
              <SystemCard
                innerRef={(element) => {
                  if (element) cardRefs.current.set(post.slug, element);
                  else cardRefs.current.delete(post.slug);
                }}
                href={pathForEssay(post.slug)}
                feedbackId={`essay:${post.slug}`}
                title={post.title}
                titleClassName="text-xl"
                meta={post.date}
                description={post.excerpt}
                footer={(
                  <>
                    <span>Open file</span>
                    <span aria-hidden="true"> :: </span>
                    <span>{post.readTime} read</span>
                  </>
                )}
                onNavigate={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  event.preventDefault();
                  openEssay(post);
                }}
              />
              {post.sourceUrl && (
                <a
                  href={post.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => interaction.interact('confirm', { source: 'pointer' })}
                  className="inline-flex min-h-[44px] items-center gap-1 px-1 text-xs font-mono normal-case tracking-normal text-blue-200/85 underline underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {post.sourceLabel || 'Published elsewhere'}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </article>
          ))}
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

  const renderListSkeleton = (count: number) => (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading content">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-blue-500/10 bg-blue-900/10 p-6">
          <div className="mb-3 h-5 w-2/3 bg-blue-900/40 animate-pulse motion-reduce:animate-none" />
          <div className="mb-2 h-3 w-full bg-blue-900/30 animate-pulse motion-reduce:animate-none" />
          <div className="h-3 w-4/5 bg-blue-900/30 animate-pulse motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );

  const renderEmptyState = (message: string) => (
    <div className="border border-blue-400/25 bg-blue-900/10 px-5 py-10 text-center" role="status">
      <p className="text-base font-light text-blue-100">{message}</p>
      {query.trim() || yearFilter !== 'all' ? (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setYearFilter('all');
          }}
          className="mt-4 inline-flex min-h-[44px] items-center border border-blue-400/40 px-4 font-mono text-xs uppercase tracking-[0.18em] text-blue-100 transition-colors hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );

  const renderYearHeading = (year: string, count: number) => (
    <h4 className="flex items-center gap-2 border-b border-blue-400/20 pb-1 font-mono text-[11px] uppercase tracking-[0.2em] text-blue-200/85">
      <span>{year}</span>
      <span aria-hidden="true" className="text-blue-300/60">·</span>
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
    const yearOptions = Array.from(new Set(yearPool.map(item => yearOf(item.date))))
      .filter(year => year !== 'Undated')
      .sort((a, b) => Number(b) - Number(a));

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
        ? `${current.shown} of ${current.total} ${meta.noun} · ${meta.blurb}`
        : `${current.total} ${meta.noun} · ${meta.blurb}`;

    const visibleValueStack = filteredValueStack.slice(0, visibleMedia);
    const remainingEpisodes = filteredValueStack.length - visibleValueStack.length;

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
          <p className="font-mono text-[12px] uppercase leading-relaxed tracking-[0.16em] text-blue-200/85" role="status" aria-live="polite">
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
                  className="min-h-[44px] shrink-0 border border-blue-400/30 px-3 font-mono text-[11px] uppercase tracking-[0.16em] text-blue-100 transition-colors hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {contentTab === 'essays' && (
          filteredEssays.length === 0
            ? renderEmptyState(`No essays match “${query.trim()}”.`)
            : renderEssays()
        )}

        {contentTab === 'posts' && (
          <div className="space-y-4">
            {postsLoading || posts === null
              ? renderListSkeleton(3)
              : filteredPosts.length === 0
                ? renderEmptyState(`No posts match “${query.trim()}”.`)
                : filteredPosts.slice(0, visiblePosts).map(item => renderPostCard(item))}
            {posts && filteredPosts.length > visiblePosts
              && renderShowMore(
                filteredPosts.length - visiblePosts,
                'posts',
                () => setVisiblePosts(count => count + 20),
                'posts:show-more',
              )}
          </div>
        )}

        {contentTab === 'podcasts' && (
          mediaLoading || !media ? renderListSkeleton(4) : (
            filteredPodcasts.length === 0 ? renderEmptyState('No episodes match these filters.') : (
              <div className="space-y-8">
                <section className="space-y-3" aria-labelledby="podcast-host-heading">
                  <h3 id="podcast-host-heading" className="border-l-2 border-blue-400 pl-2 font-mono text-xs uppercase tracking-[0.18em] text-blue-200/90">
                    Value Stack (host) · {filteredValueStack.length}
                  </h3>
                  {filteredValueStack.length === 0 ? (
                    <p className="text-sm font-light text-blue-200/80">No host episodes match these filters.</p>
                  ) : (
                    <>
                      {groupByYear(visibleValueStack).map(group => (
                        <div key={group.year} className="space-y-3">
                          {renderYearHeading(group.year, group.items.length)}
                          <div className="space-y-3">
                            {group.items.map(item => renderMediaCard(item))}
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

                <section className="space-y-3" aria-labelledby="podcast-guest-heading">
                  <h3 id="podcast-guest-heading" className="border-l-2 border-blue-400 pl-2 font-mono text-xs uppercase tracking-[0.18em] text-blue-200/90">
                    Guest appearances · {filteredAppearances.length}
                  </h3>
                  {filteredAppearances.length === 0 ? (
                    <p className="text-sm font-light text-blue-200/80">No guest appearances match these filters.</p>
                  ) : (
                    <div className="space-y-3">
                      {groupByYear(filteredAppearances).map(group => (
                        <div key={group.year} className="space-y-3">
                          {renderYearHeading(group.year, group.items.length)}
                          <div className="space-y-3">
                            {group.items.map(item => renderMediaCard(item))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )
          )
        )}

        {contentTab === 'lectures' && (
          mediaLoading || !media ? renderListSkeleton(4) : (
            filteredLectures.length === 0 ? renderEmptyState('No lectures match these filters.') : (
              <div className="space-y-7">
                {groupByYear(filteredLectures).map(group => (
                  <section key={group.year} className="space-y-3">
                    {renderYearHeading(group.year, group.items.length)}
                    {groupBySource(group.items).map(sourceGroup => (
                      <div key={sourceGroup.source} className="space-y-2">
                        <p className="pl-1 font-mono text-[11px] uppercase tracking-[0.16em] text-blue-300/90">
                          {sourceGroup.source}
                        </p>
                        <div className="space-y-3">
                          {sourceGroup.items.map(item => renderMediaCard(item))}
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
          mediaLoading || !media ? renderListSkeleton(4) : (
            filteredTutorials.length === 0
              ? renderEmptyState('No tutorials are listed yet.')
              : (
                <div className="space-y-3">
                  {filteredTutorials.map(item => renderMediaCard(item, `${item.source} · Video`))}
                </div>
              )
          )
        )}

        {contentTab === 'reading' && (
          mediaLoading || !media ? renderListSkeleton(4) : (
            filteredReading.length === 0
              ? renderEmptyState('Nothing on the shelf yet.')
              : (
                <div className="space-y-3">
                  {filteredReading.map(item => renderReadingCard(item))}
                </div>
              )
          )
        )}
      </div>
    );
  };

  const renderWork = () => (
    <div className="space-y-4 max-w-4xl mx-auto">
       <div className="flex justify-between items-center text-xs uppercase tracking-widest text-blue-200/85 border-b border-blue-500/20 pb-2 mb-4">
         <span>Organization</span>
         <span>Duration</span>
       </div>
      {WORK_DATA.map((job, i) => (
        <div 
          key={i} 
          className="group relative bg-blue-900/10 border border-blue-500/10 hover:border-blue-500/40 p-5 rounded-sm transition-all duration-300"
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-2">
            <div>
               <h3 className="text-xl font-bold text-white group-hover:text-blue-200 transition-colors">{job.company}</h3>
               {job.subRoles ? (
                 <div className="mt-2 space-y-1 pl-4 border-l border-blue-500/30">
                   {job.subRoles.map((role, idx) => (
                      <div key={idx} className="text-sm">
                         <span className="text-blue-300 font-medium">{role.title}</span>
                         <span className="text-blue-500/50 mx-2">|</span>
                         <span className="text-blue-400/70 text-xs font-mono">{role.period}</span>
                      </div>
                   ))}
                 </div>
               ) : (
                 <div className="text-blue-300 font-medium mt-1">{job.role}</div>
               )}
            </div>
            <div className="text-right mt-2 md:mt-0">
               <div className="font-mono text-sm text-blue-400">{job.period}</div>
               <div className="text-xs uppercase tracking-widest text-blue-200/85 mt-1">{job.location}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const getContent = () => {
    switch (section.id) {
      case 'social': return renderSocials();
      case 'about': return renderAbout();
      case 'portfolio': return renderPortfolio();
      case 'book': return renderBooks();
      case 'content': return renderContentHub();
      case 'work': return renderWork();
      default: return <div>Under Construction</div>;
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
      className="screen-backdrop fixed inset-x-0 top-0 z-50 flex items-stretch justify-center px-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:p-12 bg-black/60 focus:outline-none"
      style={{ height: 'var(--app-height)' }}
      data-closing={closing ? 'true' : undefined}
    >
      <div
        ref={panelRef}
        className="screen-panel w-full max-w-5xl h-full min-h-0 flex flex-col border border-blue-500/30 rounded-lg overflow-hidden bg-[#050a14] shadow-[0_0_50px_rgba(0,50,255,0.15)]"
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
              className="text-2xl font-bold tracking-widest uppercase text-white ps2-text-shadow focus:outline-none"
            >
              {section.title}
            </h1>
          </div>
        </div>

        {section.id === 'content' && renderContentTabs()}

        {/* Content Body */}
        <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 md:p-10 relative ps2-scroll">
          {getContent()}
        </div>

        {/* One context-aware footer: Back, the shortcuts for this screen, settings */}
        <div className="shrink-0 border-t border-blue-500/30 flex flex-wrap items-center justify-between gap-x-2 md:gap-x-4 gap-y-1 px-4 md:px-6 py-2 bg-black/40 text-sm">
          <button 
            type="button"
            onClick={handleBack}
            onFocus={() => interaction.interact('cursor', { id: 'nav:back', source: 'focus' })}
            className="flex min-h-[44px] items-center space-x-2 text-blue-300 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span className="uppercase tracking-widest font-mono text-xs">
              {selectedEssay ? "Return to List" : "Back to Home"}
            </span>
          </button>
          <HelpBar
            className="order-3 w-full md:order-2 md:w-auto"
            actions={helpActions}
            description={helpDescription}
          />
          <SystemSettings compact />
        </div>
      </div>
    </div>
  );
};

export default ContentScreen;