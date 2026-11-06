import React from 'react';
import { Liveline } from 'liveline';
import { usePrefersReducedMotion } from '../utils/preferences';
import { BTC_ACCENT, BTC_WINDOW_SECS, useBtcFeed } from './BtcFeed';

const BtcSparkline: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { data, value, ready, chartPaused, failed } = useBtcFeed();
  const reducedMotion = usePrefersReducedMotion();

  if (failed && value === null) {
    return (
      <div
        className={`btc-spark ${compact ? 'btc-spark--compact' : ''} btc-spark--empty`}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className={`btc-spark ${compact ? 'btc-spark--compact' : ''}`} aria-hidden="true">
      <Liveline
        data={data}
        value={value ?? 0}
        theme="dark"
        color={BTC_ACCENT}
        showValue={false}
        badge={false}
        grid={false}
        scrub={false}
        degen={false}
        exaggerate
        fill
        momentum={false}
        pulse={!reducedMotion}
        loading={!ready}
        paused={chartPaused}
        window={BTC_WINDOW_SECS}
        padding={{ top: 12, right: 22, bottom: 8, left: 8 }}
        lineWidth={2}
        lerpSpeed={reducedMotion ? 1 : 0.12}
        emptyText=""
      />
    </div>
  );
};

export default BtcSparkline;
