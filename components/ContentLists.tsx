import React from 'react';
import { Play } from 'lucide-react';
import type { EssaySummary, MediaItem, PostItem, ReadingItem } from '../types';
import { POST_IMAGE_META } from '../data/imageMeta';
import SafeImage from './SafeImage';
import SystemCard from './SystemCard';

const twitterImage = (url: string, format: 'webp' | 'jpg') =>
  `${url}${url.includes('?') ? '&' : '?'}format=${format}&name=small`;

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
    title={essay.title}
    titleClassName="essay-featured__title"
    meta={essay.date}
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
    meta={essay.date}
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
    />
  );
};

interface MediaFeatureProps {
  item: MediaItem;
}

export const MediaFeature: React.FC<MediaFeatureProps> = ({ item }) => (
  <SystemCard
    href={item.url}
    external
    feedbackId={`media:${item.url}`}
    className="media-feature"
    leading={(
      <span className="media-play" aria-hidden="true">
        <Play className="h-3.5 w-3.5" fill="currentColor" />
      </span>
    )}
    title={item.title}
    titleClassName="media-feature__title"
    meta={item.date}
    footer={item.source}
  />
);

export const MediaRow: React.FC<{ item: MediaItem }> = ({ item }) => (
  <SystemCard
    href={item.url}
    external
    feedbackId={`media:${item.url}`}
    className="media-row"
    leading={(
      <span className="media-play" aria-hidden="true">
        <Play className="h-3.5 w-3.5" fill="currentColor" />
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

export const TutorialRow: React.FC<{ item: MediaItem }> = ({ item }) => (
  <SystemCard
    href={item.url}
    external
    feedbackId={`media:${item.url}`}
    className="tutorial-row"
    title={item.title}
    titleClassName="tutorial-row__title"
    meta={item.date}
  />
);
