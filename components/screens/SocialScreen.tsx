import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Mail } from 'lucide-react';
import { SOCIAL_LINKS } from '../../constants';
import { interaction } from '../../utils/Interaction';
import { announce } from '../../utils/liveRegion';
import { writeClipboard } from '../../utils/clipboard';
import SystemCard from '../SystemCard';

const socialMark = (platform: string): string => {
  if (platform.toLowerCase().includes('linkedin')) return 'in';
  if (platform.toLowerCase().includes('twitter') || platform === 'X') return 'X';
  return '@';
};

const SocialScreen: React.FC = () => {
  const email = SOCIAL_LINKS.find(link => link.url.startsWith('mailto:'));
  const others = SOCIAL_LINKS.filter(link => !link.url.startsWith('mailto:'));
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const copyEmail = async () => {
    if (!email) return;
    try {
      await writeClipboard(email.handle);
      setCopied(true);
      announce('Email copied to clipboard');
      interaction.interact('confirm', { source: 'pointer' });
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2200);
    } catch {
      announce('Could not copy the email address');
      interaction.interact('error', { source: 'pointer' });
    }
  };

  return (
    <div className="social-screen">
      <section className="social-primary" aria-labelledby="social-email-heading">
        <p id="social-email-heading" className="ps2-label social-primary__label">
          Email
        </p>

        {email && (
          <div className="social-email-row">
            <a
              href={email.url}
              className="social-email"
              onFocus={() => interaction.interact('cursor', { id: 'social:email', source: 'focus' })}
              onClick={() => {
                interaction.interact('confirm', { source: 'pointer' });
                announce('Opening your mail app');
              }}
            >
              <Mail className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{email.handle}</span>
            </a>
            <button
              type="button"
              onClick={() => void copyEmail()}
              onFocus={() => interaction.interact('cursor', { id: 'social:copy', source: 'focus' })}
              className="social-copy"
              aria-label={copied ? 'Email copied' : `Copy email address ${email.handle}`}
            >
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}
      </section>

      <ul className="social-rows" aria-label="Other places to find Zach">
        {others.map((link) => (
          <li key={link.platform}>
            <SystemCard
              href={link.url}
              external
              feedbackId={`social:${link.platform}`}
              className="social-row"
              leading={(
                <span className="social-mark" aria-hidden="true">
                  {socialMark(link.platform)}
                </span>
              )}
              title={link.platform === 'Twitter/X' ? 'X' : link.platform}
              meta={<span className="social-handle">{link.handle}</span>}
            />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SocialScreen;
