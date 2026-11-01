import React from 'react';
import { Play } from 'lucide-react';
import type { EssaySummary, MediaItem, PostItem, ReadingItem } from '../types';
import { POST_IMAGE_META } from '../data/imageMeta';
import SafeImage from './SafeImage';
import SystemCard from './SystemCard';

const twitterImage = (url: string, format: 'webp' | 'jpg') =>
  `${url}${url.includes('?') ? '&' : '?'}format=${format}&name=small`;

const metric = (value: number, noun: string): string =>
  `${value.toLocaleString()} ${value === 1 ? noun : `${noun}s`}`;

interface EssayProps {
  essay: EssaySummary;
  href: string;
  feedbackId: string;
  innerRef?: React.Ref<HTMLAnchorElement>;
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

export const FeaturedEssay: React.FC<EssayProps> = ({
  essay,
  href,
  feedbackId,
  innerRef,
  onNavigate,
}) => (
  <SystemCard
    href={href}
    feedbackId={feedbackId}
    innerRef={innerRef}
    className="essay-featured"
    eyebrow="Latest essay"
    title={essay.title}
    titleClassName="essay-featured__title"
    meta={essay.date}
    description={essay.excerpt}
    footer={(
      <>
        <span>Read essay</span>
        <span aria-hidden="true"> :: </span>
        <span>{essay.readTime} read</span>
      </>
    )}
    onNavigate={onNavigate}
  />
);

export const EssayRow: React.FC<EssayProps> = ({
  essay,
  href,
  feedbackId,
  innerRef,
  onNavigate,
}) => (
  <SystemCard
    href={href}
    feedbackId={feedbackId}
    innerRef={innerRef}
    className="essay-row"
    title={essay.title}
    titleClassName="essay-row__title"
    meta={<span>{essay.date} <span aria-hidden="true">·</span> {essay.readTime}</span>}
    onNavigate={onNavigate}
  />
);

interface PostCardProps {
  post: PostItem;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const imageMeta = post.image ? POST_IMAGE_META[post.image] : undefined;
  const text = post.text.trim() || 'View post';

  return (
    <SystemCard
      href={post.url}
      external
      feedbackId={`post:${post.id}`}
      className="post-card"
      title={text}
      titleClassName="post-card__text"
      meta={post.date}
      media={post.image ? (
        <SafeImage
          src={twitterImage(post.image, 'webp')}
          alt=""
          width={imageMeta?.width}
          height={imageMeta?.height}
          className="post-media"
          imageClassName="post-media__img"
          referrerPolicy="no-referrer"
          fallbackLabel="Post image unavailable"
        />
      ) : undefined}
      footer={(
        <span className="post-metrics">
          <span>{metric(post.likes, 'like')}</span>
          <span aria-hidden="true" className="post-metrics__sep">·</span>
          <span>{metric(post.replies, 'reply')}</span>
          {(post.quotes ?? 0) > 0 && (
            <>
              <span aria-hidden="true" className="post-metrics__sep">·</span>
              <span>{metric(post.quotes ?? 0, 'quote')}</span>
            </>
          )}
          <span aria-hidden="true" className="post-metrics__sep">·</span>
          <span>{metric(post.reposts, 'repost')}</span>
        </span>
      )}
    />
  );
};

interface MediaFeatureProps {
  item: MediaItem;
  label: string;
}

export const MediaFeature: React.FC<MediaFeatureProps> = ({ item, label }) => (
  <SystemCard
    href={item.url}
    external
    feedbackId={`media:${item.url}`}
    className="media-feature"
    leading={(
      <span className="media-feature__play" aria-hidden="true">
        <Play className="h-4 w-4" fill="currentColor" />
      </span>
    )}
    eyebrow={label}
    title={item.title}
    titleClassName="media-feature__title"
    meta={item.date}
    footer={item.source}
  />
);

export const MediaRow: React.FC<{ item: MediaItem; wide?: boolean }> = ({ item, wide = false }) => (
  <SystemCard
    href={item.url}
    external
    feedbackId={`media:${item.url}`}
    className={`media-row ${wide ? 'media-row--wide' : ''}`}
    leading={(
      <span className="media-row__play" aria-hidden="true">
        <Play className="h-3 w-3" fill="currentColor" />
      </span>
    )}
    title={item.title}
    titleClassName="media-row__title"
    meta={<span>{item.date} <span aria-hidden="true">·</span> {item.source}</span>}
  />
);

export const ReadingRow: React.FC<{ item: ReadingItem }> = ({ item }) => (
  <SystemCard
    href={item.url}
    external
    feedbackId={`reading:${item.url}`}
    className="reading-row"
    title={item.title}
    titleClassName="reading-row__title"
    meta={<span>{item.author} <span aria-hidden="true">·</span> {item.date}</span>}
  />
);

export const TutorialRow: React.FC<{ item: MediaItem }> = ({ item }) => {
  const format = item.format ?? (/(youtu\.be|youtube\.com)/i.test(item.url) ? 'Video' : 'Guide');
  return (
    <SystemCard
      href={item.url}
      external
      feedbackId={`media:${item.url}`}
      className="tutorial-row"
      title={item.title}
      titleClassName="tutorial-row__title"
      meta={item.date}
      description={item.outcome}
      footer={(
        <span className="tutorial-badge">
          <Play className="h-3 w-3" aria-hidden="true" />
          {format}
        </span>
      )}
    />
  );
};
