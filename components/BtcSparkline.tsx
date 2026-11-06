import React, { useEffect, useState } from 'react';
import { Liveline } from 'liveline';
import { usePrefersReducedMotion } from '../utils/preferences';
import { BTC_ACCENT, useBtcFeed } from './BtcFeed';

/** Hold the loading wave after series is ready so Liveline's morph always
 *  starts from a visible wave, not a blank canvas first paint. */
const REVEAL_DWELL_MS = 420;

const BtcSparkline: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { chartData, chartWindow, value, ready, chartPaused } = useBtcFeed();
  const reducedMotion = usePrefersReducedMotion();
  // Soft gate: series can land before we clear `loading`, so the wave→line
  // morph lerps instead of popping. Reset if the feed drops readiness.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!ready) {
      setRevealed(false);
      return undefined;
    }
    if (reducedMotion) {
      setRevealed(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setRevealed(true), REVEAL_DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [ready, reducedMotion]);

  // Always keep Liveline mounted — swapping to an empty shell was the blank
  // beat between skeleton/wave and the first live paint (Family Values).
  const showWave = !revealed;
  return (
    <div
      className={`btc-spark ${compact ? 'btc-spark--compact' : ''}${showWave ? ' btc-spark--booting' : ''}`}
      aria-hidden="true"
      data-ready={revealed ? 'true' : 'false'}
    >
      {/* CSS wave underlay: covers canvas size-0 frames so the slot never
          goes blank before Liveline's first paint. Crossfades out once the
          live morph is under way. */}
      <div className="btc-spark__wave" aria-hidden="true" />
      <Liveline
        data={chartData}
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
        pulse={!reducedMotion && revealed}
        loading={showWave}
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
