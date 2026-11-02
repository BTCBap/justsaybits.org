import React, { useCallback, useEffect, useRef, useState } from 'react';import { Link2 } from 'lucide-react';
import type { EssaySummary } from '../types';
import { interaction } from '../utils/Interaction';
import { announce } from '../utils/liveRegion';
import { usePrefersReducedMotion } from '../utils/preferences';
import { canonicalUrl, pathForEssay } from '../utils/router';
import EssayBody, {
  scrollToHeading,
  type EssayDocument,
  type EssayHeading,
} from './EssayBody';
import SystemCard from './SystemCard';

interface ReaderBarProps {
  essay: EssaySummary;
  headings: EssayHeading[];
  bodyRef: React.RefObject<HTMLDivElement | null>;
  /** Re-runs the progress measurement when the body content changes height. */
  content: string | null;
}

const writeClipboard = async (text: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(area);
  if (!copied) throw new Error('copy failed');
};

/**
 * Persistent reader chrome: a compact title, the date and read time, a copy
 * link action, a collapsible contents list for long essays, and a progress
 * line. It sits outside the scroll container so it never covers the title.
 */
export const ReaderBar: React.FC<ReaderBarProps> = ({ essay, headings, bodyRef, content }) => {
  const reducedMotion = usePrefersReducedMotion();
  const progressRef = useRef<HTMLSpanElement>(null);
  const contentsRef = useRef<HTMLDetailsElement>(null);
  const copiedTimer = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);

  const readMinutes = Number.parseInt(essay.readTime, 10) || 0;
  // Reserve the contents row as soon as the essay is known: waiting for the
  // body import to add it would shift the article down mid-read.
  const showContents = readMinutes >= 6;

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const max = body.scrollHeight - body.clientHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, body.scrollTop / max)) : 1;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress})`;
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    body.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // Keep the line honest when the scroll frame or its content resizes.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    observer?.observe(body);
    const timer = window.setTimeout(update, 120);
    void document.fonts?.ready.then(schedule).catch(() => undefined);

    return () => {
      body.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
      window.clearTimeout(timer);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [bodyRef, content, essay.slug]);

  useEffect(() => () => {
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
  }, []);

  const copyLink = useCallback(async () => {
    try {
      await writeClipboard(canonicalUrl(pathForEssay(essay.slug)));
      setCopied(true);
      announce('Link copied');
      interaction.interact('confirm', { source: 'pointer' });
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2200);
    } catch {
      announce('Could not copy the link');
      interaction.interact('error', { source: 'pointer' });
    }
  }, [essay.slug]);

  return (
    <div className="reader-bar shrink-0">
      <div className="flex items-center gap-3 px-4 py-2 md:px-6">
        <div className="min-w-0 flex-1">
          <p className="reader-bar__meta">{essay.date}</p>
          <p className="reader-bar__title">{essay.title}</p>
        </div>
        <button
          type="button"
          onClick={() => void copyLink()}
          onFocus={() => interaction.interact('cursor', { id: 'essay:copy', source: 'focus' })}
          className="reader-action shrink-0"
          aria-label={copied ? 'Link copied' : 'Copy link to this essay'}
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{copied ? 'Copied' : 'Copy link'}</span>
        </button>
      </div>

      {showContents && (
        <details
          ref={contentsRef}
          className="reader-contents"
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || !contentsRef.current?.open) return;
            event.preventDefault();
            event.stopPropagation();
            contentsRef.current.open = false;
            contentsRef.current.querySelector('summary')?.focus();
          }}
        >
          <summary>
            Contents
          </summary>
          {headings.length > 0 && (
            <nav aria-label="Essay contents">
              <ol className="reader-contents__list">
                {headings.map(heading => (
                  <li key={heading.id} data-level={heading.level}>
                    <a
                      href={`#${heading.id}`}
                      onClick={(event) => {
                        event.preventDefault();
                        if (contentsRef.current) contentsRef.current.open = false;
                        scrollToHeading(heading.id, !reducedMotion);
                      }}
                    >
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </details>
      )}

      <div className="reader-progress" aria-hidden="true">
        <span ref={progressRef} />
      </div>
    </div>
  );
};

interface EssayArticleProps {
  essay: EssaySummary;
  doc: EssayDocument | null;
  loading: boolean;
  error: boolean;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  onRetry: () => void;
  onNavigateEssay: (slug: string) => void;
  newer?: EssaySummary;
  older?: EssaySummary;
}

const goToEssay = (
  event: React.MouseEvent<HTMLAnchorElement>,
  slug: string,
  onNavigateEssay: (slug: string) => void,
): void => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  onNavigateEssay(slug);
};

/** The long-form reading surface: prose at a 65ch measure, real headings. */
export const EssayArticle: React.FC<EssayArticleProps> = ({
  essay,
  doc,
  loading,
  error,
  titleRef,
  onRetry,
  onNavigateEssay,
  newer,
  older,
}) => {
  const blocks = doc?.blocks ?? [];

  // A heading permalink survives a reload: the body loads after the browser's
  // own hash scroll, so place the heading once its text exists.
  useEffect(() => {
    if (!doc) return;
    const raw = window.location.hash.slice(1);
    if (!raw) return;
    let id = raw;
    try {
      id = decodeURIComponent(raw);
    } catch {
      // Keep the raw value when the fragment is not valid percent-encoding.
    }
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [doc]);

  return (
    <article className="essay-article" aria-busy={loading}>
      <header className="essay-article__header">
        <h1
          id="essay-title"
          ref={titleRef}
          tabIndex={-1}
          className="essay-article__title focus:outline-none"
        >
          {essay.title}
        </h1>
        <div className="essay-article__meta">
          <span>{essay.date}</span>
          {essay.sourceUrl && (
            <>
              <span className="sep" aria-hidden="true">//</span>
              <a
                href={essay.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onFocus={() => interaction.interact('cursor', { id: 'essay:source', source: 'focus' })}
                onClick={() => interaction.interact('confirm', { source: 'pointer' })}
                className="text-[var(--text-secondary)] underline underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {essay.sourceLabel || 'Published elsewhere'}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </>
          )}
        </div>
      </header>

      <div className="essay-prose-wrap">
        {loading ? (
          <div className="space-y-4" role="status" aria-live="polite">
            <span className="sr-only">Loading essay…</span>
            {[92, 100, 96, 88, 76, 100, 94].map((width, index) => (
              <div
                key={index}
                className="h-4 animate-pulse bg-blue-900/40 motion-reduce:animate-none"
                style={{ width: `${width}%` }}
              />
            ))}
            <div className="h-48 animate-pulse bg-blue-900/20 motion-reduce:animate-none" />
          </div>
        ) : error ? (
          <div className="border border-blue-500/30 bg-blue-900/10 p-6 text-base font-light text-blue-100" role="status">
            <p>That file did not open.</p>
            <button
              type="button"
              onFocus={() => interaction.interact('cursor', { id: 'essay:retry', source: 'focus' })}
              onClick={onRetry}
              className="mt-3 inline-flex min-h-[44px] items-center font-mono text-xs uppercase tracking-[0.14em] text-blue-200 underline underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Try again
            </button>
          </div>
        ) : blocks.length > 0 ? (
          <EssayBody blocks={blocks} />
        ) : null}
      </div>

      {!loading && !error && (newer || older) && (
        <footer className="essay-footer">
          <h2 className="essay-footer__head">More essays</h2>
          <nav className="essay-next" aria-label="More essays">
            {newer && (
              <SystemCard
                href={pathForEssay(newer.slug)}
                feedbackId={`essay-next:${newer.slug}`}
                title={newer.title}
                meta={newer.date}
                onNavigate={(event) => goToEssay(event, newer.slug, onNavigateEssay)}
              />
            )}
            {older && (
              <SystemCard
                href={pathForEssay(older.slug)}
                feedbackId={`essay-prev:${older.slug}`}
                title={older.title}
                meta={older.date}
                onNavigate={(event) => goToEssay(event, older.slug, onNavigateEssay)}
              />
            )}
          </nav>
        </footer>
      )}
    </article>
  );
};
