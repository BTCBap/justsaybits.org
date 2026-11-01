import React from 'react';
import { ESSAY_IMAGE_META } from '../data/imageMeta';
import { usePrefersReducedMotion } from '../utils/preferences';

/**
 * A small, controlled Markdown subset for essay bodies.
 *
 * The data is authored in this repository, so the parser stays deliberately
 * narrow: headings, paragraphs, lists, quotes, rules, inline code, bold,
 * italic, links, and the existing %%YOUTUBE / %%IMAGE / %%TWEET tokens.
 */

export interface EssayHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export type EssayBlock =
  | { kind: 'heading'; level: 2 | 3; id: string; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'rule' }
  | { kind: 'image'; src: string; alt?: string; caption?: string }
  | { kind: 'youtube'; id: string; start?: string }
  | { kind: 'tweet'; url: string; name?: string; username?: string; text?: string };

export interface EssayDocument {
  blocks: EssayBlock[];
  headings: EssayHeading[];
}

const TOKEN_RE = /%%(YOUTUBE|IMAGE|TWEET):([\s\S]*?)%%/g;

const BLOCK_START = /^(#{1,3}\s+|>\s?|[-*+]\s+|\d+[.)]\s+|-{3,}$|\*{3,}$|_{3,}$)/;

const slugifyHeading = (text: string): string => {
  const plain = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64);
  return plain || 'section';
};

const uniqueHeadingId = (text: string, used: Set<string>): string => {
  const base = slugifyHeading(text);
  let id = base;
  let count = 2;
  while (used.has(id)) {
    id = `${base}-${count}`;
    count += 1;
  }
  used.add(id);
  return id;
};

const tokenToBlock = (type: string, raw: string): EssayBlock | null => {
  try {
    const data = JSON.parse(raw) as Record<string, string>;
    if (type === 'YOUTUBE' && data.id) {
      return { kind: 'youtube', id: data.id, start: data.start };
    }
    if (type === 'IMAGE' && data.src) {
      return { kind: 'image', src: data.src, alt: data.alt, caption: data.caption };
    }
    if (type === 'TWEET' && data.url) {
      return { kind: 'tweet', url: data.url, name: data.name, username: data.username, text: data.text };
    }
  } catch {
    // A malformed token is skipped rather than breaking the rest of the essay.
  }
  return null;
};

const parseText = (
  raw: string,
  blocks: EssayBlock[],
  headings: EssayHeading[],
  used: Set<string>,
): void => {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level: 2 | 3 = heading[1].length >= 3 ? 3 : 2;
      const text = heading[2].trim();
      const id = uniqueHeadingId(text, used);
      headings.push({ id, text, level });
      blocks.push({ kind: 'heading', level, id, text });
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: 'rule' });
      i += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ kind: 'quote', text: quote.join('\n') });
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ''));
        i += 1;
      }
      blocks.push({ kind: 'list', ordered: false, items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i += 1;
      }
      blocks.push({ kind: 'list', ordered: true, items });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length) {
      const line = lines[i];
      const next = line.trim();
      if (!next) break;
      if (paragraph.length && BLOCK_START.test(next)) break;
      paragraph.push(line);
      i += 1;
    }
    const text = paragraph.join('\n').trim();
    if (text) blocks.push({ kind: 'paragraph', text });
  }
};

export const parseEssay = (content: string): EssayDocument => {
  const blocks: EssayBlock[] = [];
  const headings: EssayHeading[] = [];
  const used = new Set<string>();

  TOKEN_RE.lastIndex = 0;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_RE.exec(content))) {
    if (match.index > last) {
      parseText(content.slice(last, match.index), blocks, headings, used);
    }
    const block = tokenToBlock(match[1], match[2]);
    if (block) blocks.push(block);
    last = match.index + match[0].length;
  }

  if (last < content.length) {
    parseText(content.slice(last), blocks, headings, used);
  }

  return { blocks, headings };
};

/** Scroll a heading into view inside the reader and keep the URL shareable. */
export const scrollToHeading = (id: string, smooth: boolean): void => {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  if (element instanceof HTMLElement) element.focus({ preventScroll: true });
  try {
    window.history.replaceState(window.history.state, '', `#${id}`);
  } catch {
    // A blocked history update must not stop the reader from scrolling.
  }
};

const INLINE_RE = /(\*\*[\s\S]*?\*\*|\*[^*\n]+?\*|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/g;

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let index = 0;
  let match: RegExpExecArray | null;

  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;

    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      parts.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (link) {
        const href = link[2];
        const external = /^https?:\/\//i.test(href);
        parts.push(
          <a
            key={key}
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {link[1]}
            {external && <span className="sr-only"> (opens in a new tab)</span>}
          </a>,
        );
      } else {
        parts.push(token);
      }
    }
    last = match.index + token.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

const EssayBody: React.FC<{ blocks: EssayBlock[] }> = ({ blocks }) => {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="essay-prose">
      {blocks.map((block, index) => {
        const key = `block-${index}`;

        if (block.kind === 'heading') {
          const HeadingTag: 'h2' | 'h3' = block.level === 2 ? 'h2' : 'h3';
          // Keep the small "#" link out of the heading's accessible name.
          const headingLabel = block.text
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/[`*_~]/g, '')
            .trim();
          return (
            <HeadingTag key={key} id={block.id} tabIndex={-1} aria-label={headingLabel}>
              {renderInline(block.text, key)}
              <a
                className="essay-anchor"
                href={`#${block.id}`}
                aria-label={`Link to ${headingLabel}`}
                onClick={(event) => {
                  event.preventDefault();
                  scrollToHeading(block.id, !reducedMotion);
                }}
              >
                #
              </a>
            </HeadingTag>
          );
        }

        if (block.kind === 'paragraph') {
          return <p key={key}>{renderInline(block.text, key)}</p>;
        }

        if (block.kind === 'list') {
          const ListTag: 'ol' | 'ul' = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag key={key}>
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
              ))}
            </ListTag>
          );
        }

        if (block.kind === 'quote') {
          return <blockquote key={key}>{renderInline(block.text, key)}</blockquote>;
        }

        if (block.kind === 'rule') {
          return <hr key={key} />;
        }

        if (block.kind === 'image') {
          const meta = ESSAY_IMAGE_META[block.src];
          return (
            <figure key={key}>
              <img
                src={block.src}
                srcSet={meta?.srcSet || undefined}
                sizes={meta?.sizes}
                width={meta?.width}
                height={meta?.height}
                alt={block.alt || block.caption || ''}
                loading="lazy"
                decoding="async"
              />
              {block.caption && (
                <figcaption>{renderInline(block.caption, `${key}-cap`)}</figcaption>
              )}
            </figure>
          );
        }

        if (block.kind === 'youtube') {
          const start = block.start ? `&start=${encodeURIComponent(block.start)}` : '';
          return (
            <div key={key} className="essay-embed my-6 w-full overflow-hidden">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${block.id}?rel=0${start}`}
                  title="Embedded video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>
            </div>
          );
        }

        return (
          <a
            key={key}
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            className="essay-embed my-6 block p-4 transition-colors hover:border-white"
          >
            {block.name && <div className="text-white">{block.name}</div>}
            {block.username && (
              <div className="mb-2 font-mono text-xs text-blue-200/80">@{block.username}</div>
            )}
            {block.text && <p className="whitespace-pre-wrap text-base text-blue-50">{block.text}</p>}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        );
      })}
    </div>
  );
};

export default EssayBody;
