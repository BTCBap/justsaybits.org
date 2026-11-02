import React from 'react';
import { ExternalLink } from 'lucide-react';
import { BOOK_DATA } from '../../constants';
import { interaction } from '../../utils/Interaction';
import SafeImage from '../SafeImage';

const StarGlyph: React.FC<{ filled: boolean }> = ({ filled }) => (
  <svg viewBox="0 0 20 20" className="book-star" aria-hidden="true" focusable="false">
    <path
      d="M10 1.6 12.4 7l5.9.5-4.5 3.9 1.4 5.8L10 14.2l-5.2 3 1.4-5.8L1.7 7.5 7.6 7Z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </svg>
);

const BookScreen: React.FC = () => {
  const book = BOOK_DATA[0];
  if (!book) return null;

  const rating = Math.max(0, Math.min(5, Math.round(book.rating)));

  return (
    <div className="book-screen">
      <article className="book-panel">
        <div className="book-cover-stage">
          <div className="book-cover">
            {book.coverImage ? (
              <SafeImage
                src={book.coverImage}
                srcSet={book.coverSrcSet}
                sizes="(min-width: 768px) 268px, 216px"
                alt={`${book.title} book cover`}
                width={book.coverWidth ?? 640}
                height={book.coverHeight ?? 960}
                loading="lazy"
                className="book-cover__image"
                imageClassName="book-cover__img"
                fallbackLabel="Cover unavailable"
              />
            ) : (
              <div className={`book-cover__fallback ${book.coverColor}`}>
                <span>{book.title}</span>
                <span className="ps2-meta">{book.author}</span>
              </div>
            )}
            <span className="book-cover__spine" aria-hidden="true" />
          </div>
          <span className="book-cover__shadow" aria-hidden="true" />
        </div>

        <div className="book-copy">
          <p className="ps2-label book-publisher">Bitcoin Magazine Books</p>
          <h2 className="book-title">{book.title}</h2>
          {book.subtitle && <p className="book-subtitle ps2-meta">{book.subtitle}</p>}
          <p className="book-author">by {book.author}</p>

          <div className="book-rating" role="img" aria-label={`Rated ${rating} out of 5`}>
            {Array.from({ length: 5 }).map((_, index) => (
              <StarGlyph key={index} filled={index < rating} />
            ))}
            <span className="book-rating__text ps2-meta">{rating} / 5</span>
          </div>

          <details className="book-note">
            <summary>Read the author&apos;s note</summary>
            <p>{book.thoughts}</p>
          </details>

          {book.url && (
            <a
              href={book.url}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="book-cta"
              onFocus={() => interaction.interact('cursor', { id: 'book:get', source: 'focus' })}
              onClick={() => interaction.interact('confirm', { source: 'pointer' })}
            >
              <span>Get the book</span>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </div>
      </article>
    </div>
  );
};

export default BookScreen;
