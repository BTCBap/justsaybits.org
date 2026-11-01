import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { WORK_DATA } from '../../constants';
import ScreenLink from '../ScreenLink';

const BELIEFS = [
  'Financial freedom from centralized authority',
  'Data ownership and privacy as fundamental rights',
  'Time is our scarcest asset',
  "Critical thinking and AI literacy are the major skills you'll need to thrive",
  'Tools should be open and accessible to all',
];

const OBJECTIVES = [
  'Building open source tools',
  'Leveraging AI and automation to win back time',
  'Promoting Bitcoin adoption and freedom technologies',
  'Prioritizing long-term value creation over short-term gains',
];

/** Small original marks; the text already carries the meaning. */
const DiamondGlyph: React.FC = () => (
  <svg viewBox="0 0 10 10" className="about-glyph" aria-hidden="true" focusable="false">
    <path d="M5 1 9 5 5 9 1 5Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const RingGlyph: React.FC = () => (
  <svg viewBox="0 0 10 10" className="about-glyph" aria-hidden="true" focusable="false">
    <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="5" cy="5" r="1" fill="currentColor" />
  </svg>
);

const AboutScreen: React.FC = () => {
  const current = WORK_DATA[0];

  return (
    <div className="about-screen">
      <div className="about-hero">
        <figure className="about-portrait">
          <div className="about-portrait__frame">
            <img
              src="/about-portrait.webp"
              alt="Pencil sketch portrait of Zach Wischler"
              width={320}
              height={320}
              decoding="async"
              className="about-portrait__img"
            />
          </div>
          <figcaption className="about-portrait__caption">
            Zach Wischler <span aria-hidden="true">·</span> New Orleans
          </figcaption>
        </figure>

        <div className="about-intro">
          <p className="about-now">
            <span className="ps2-label about-now__label">Now</span>
            <span>
              {current.role ?? current.company}
              {current.role ? `, ${current.company}` : ''}
            </span>
          </p>

          <blockquote className="about-quote">
            Dedicated to advancing individual sovereignty through cryptography.
          </blockquote>

          <p className="about-copy">
            After a decade in traditional finance, I saw the limitations of centralized institutions
            firsthand. My time is now dedicated to building the alternatives that prioritize individual
            freedom, ensuring users retain control over their assets and digital lives.
          </p>

          <nav className="about-links" aria-label="More about Zach">
            <ScreenLink to="/work" feedbackId="about:work" className="about-link">
              Work history <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </ScreenLink>
            <ScreenLink to="/book" feedbackId="about:book" className="about-link">
              The Bitcoin Tao <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </ScreenLink>
            <ScreenLink to="/social" feedbackId="about:social" className="about-link">
              Say hello <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </ScreenLink>
          </nav>
        </div>
      </div>

      <div className="about-panels">
        <section className="about-panel" aria-labelledby="about-beliefs">
          <h2 id="about-beliefs" className="ps2-label about-panel__label">Core Beliefs</h2>
          <ul className="about-list">
            {BELIEFS.map((belief) => (
              <li key={belief}>
                <DiamondGlyph />
                <span>{belief}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="about-panel" aria-labelledby="about-objectives">
          <h2 id="about-objectives" className="ps2-label about-panel__label">Current Objectives</h2>
          <ul className="about-list">
            {OBJECTIVES.map((objective) => (
              <li key={objective}>
                <RingGlyph />
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default AboutScreen;
