import React from 'react';
import { Liveline } from 'liveline';
import { usePrefersReducedMotion } from '../utils/preferences';
import { BTC_ACCENT, useBtcFeed } from './BtcFeed';

const EMPTY: never[] = [];

/**
 * One Liveline canvas from first paint to live chart — no CSS underlay, no
 * remount. Boot is Liveline's own loading wave (`loading` + empty data).
 *
 * Data and `loading` flip together on the same render: if data arrives while
 * `loading` is still true, Liveline swaps its 32-point wave for a grey
 * morph-at-reveal-0 path (visible shape/colour jump). The seed series is
 * densified to ~1 point/sec across the window (BtcFeed) so the wave→line morph
 * has enough points to start exactly on the wave and never culls to <2
 * visible points (Liveline paints nothing — the blank beat).
 */
const BtcSparkline: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { chartData, chartWindow, value, ready, chartPaused } = useBtcFeed();
  const reducedMotion = usePrefersReducedMotion();
  const live = ready && value !== null;

  return (
    <div
      className={`btc-spark ${compact ? 'btc-spark--compact' : ''}`}
      aria-hidden="true"
      data-ready={live ? 'true' : 'false'}
    >
      <Liveline
        data={live ? chartData : EMPTY}
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
        pulse={!reducedMotion && live}
        loading={!live}
        paused={chartPaused}
        window={chartWindow}
        padding={{ top: 12, right: 22, bottom: 8, left: 8 }}
        lineWidth={2}
        lerpSpeed={reducedMotion ? 1 : 0.12}
        emptyText=""
      />
    </div>
  );
};

export default BtcSparkline;
