import React, { useEffect, useState } from 'react';

interface SafeImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  srcSet?: string;
  sizes?: string;
  /** Extra class for the aspect-ratio frame, not the image itself. */
  className?: string;
  imageClassName?: string;
  loading?: 'eager' | 'lazy';
  decoding?: 'async' | 'sync' | 'auto';
  fetchPriority?: 'high' | 'low' | 'auto';
  referrerPolicy?: React.ImgHTMLAttributes<HTMLImageElement>['referrerPolicy'];
  fallbackLabel?: string;
}

/**
 * Reserves the image's final box before it decodes, shows a quiet skeleton
 * while it loads, and swaps a labelled panel in when the request fails so a
 * broken thumbnail does not leave a hole.
 */
const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  width,
  height,
  srcSet,
  sizes,
  className = '',
  imageClassName = '',
  loading = 'lazy',
  decoding = 'async',
  fetchPriority,
  referrerPolicy,
  fallbackLabel,
}) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    setState('loading');
  }, [src, srcSet]);

  return (
    <span
      className={`safe-image ${className}`}
      data-state={state}
      style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined}
    >
      {state !== 'error' ? (
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          decoding={decoding}
          fetchPriority={fetchPriority}
          referrerPolicy={referrerPolicy}
          className={`safe-image__img ${imageClassName}`}
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
        />
      ) : (
        <span className="safe-image__fallback" role="img" aria-label={alt}>
          <span aria-hidden="true" className="safe-image__fallback-mark">×</span>
          <span>{fallbackLabel ?? 'Image unavailable'}</span>
        </span>
      )}
      {state === 'loading' && <span className="safe-image__skeleton" aria-hidden="true" />}
    </span>
  );
};

export default SafeImage;
